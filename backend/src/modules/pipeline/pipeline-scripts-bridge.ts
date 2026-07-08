/**
 * Bridge: lazy-loads refactored pipeline scripts at runtime.
 *
 * Why runtime `require()`?
 * ─────────────────────────
 * The legacy pipeline scripts live under
 * `backend/pipeline/scripts/` and many pull in `playwright`, `axios`,
 * or `csv-parse` — none of which are backend dependencies (Playwright
 * is the worker's dep; axios / csv-parse are declared in
 * `backend/pipeline/package.json` but not actually pnpm-hoisted into
 * the workspace root). Including `pipeline/scripts/scraping/` in the
 * backend `tsconfig.json` include path would force backend's package
 * to add those deps and pollute the NestJS runtime with browser
 * automation code we never actually execute.
 *
 * Instead, each adapter calls the typed wrappers exported here. At
 * runtime, ts-node (active in dev mode via `nest start`) compiles
 * the .ts script on demand. TypeScript sees the canonical `LoadResult`
 * / `ScrapeResult` / `StagingResult` shapes because the wrappers
 * declare those signatures directly — so consumers still get full
 * IDE autocomplete without resolving playwright at compile time.
 *
 * The `require()` calls go through `runtimeRequire()` which both
 * (a) hides the resolved path string from TypeScript's static
 * resolver (a runtime `'' + segments` concatenation defeats the
 * `nodenext` module resolver from following `.ts` paths under
 * `pipeline/scripts/`), and (b) goes through Node's real `require()`
 * via `eval('require')` so ts-jest and webpack cannot fold the call.
 */
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import type {
  LoadResult,
  ScrapeResult,
  SourceConfig,
  StagingOptions,
  StagingResult,
} from './interfaces';

/**
 * Build the absolute path to a pipeline script. Hidden behind `eval`
 * so `module: "nodenext"` doesn't try to statically resolve the
 * .ts file at compile time.
 */
function pipelineScriptsDir(): string {
  const here = __dirname;
  return path.resolve(here, '..', '..', '..', 'pipeline', 'scripts');
}

let _tsNodeRegistered = false;

/**
 * Lazy-register `ts-node` so the runtime `require()` below can
 * transparently load `.ts` pipeline scripts. NestJS doesn't register
 * ts-node by default (the startup path is `nest start` → tsc → node),
 * and ts-node is already a dev-dep of the backend so it's on disk
 * under `backend/node_modules/ts-node`. The first call pays the
 * ~30 ms cost of register(); subsequent calls hit the no-op branch.
 */
function ensureTsNode(): void {
  if (_tsNodeRegistered) return;
  try {
    // Resolve from the NestJS workspace root so ts-node is found via
    // backend/node_modules rather than dist/node_modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tsNode = require(require.resolve('ts-node', {
      paths: [path.resolve(__dirname, '..', '..', '..')],
    })) as { register: (opts?: { transpileOnly?: boolean }) => unknown };
    tsNode.register({ transpileOnly: true });
    _tsNodeRegistered = true;
  } catch (err) {
    // Fall through: require will throw if the script is .ts
    // and ts-node wasn't registered. Callers see the require error.
    _tsNodeRegistered = false;
    // eslint-disable-next-line no-console
    console.warn('[pipeline-scripts-bridge] ts-node register failed:', (err as Error).message);
  }
}

/**
 * Runtime `require()` that bypasses TypeScript's `nodenext` static
 * resolution and webpack/ts-jest's `require()` folding. The
 * arguments are joined as strings at call-time so TS never sees
 * a literal `pipeline/scripts/...` it could try to follow.
 *
 * Lazy-registers `ts-node` once so the target .ts files (under
 * `backend/pipeline/scripts/`) load without explicit pre-build.
 */
function runtimeRequire(...segments: string[]): unknown {
  ensureTsNode();
  const joined = segments.map((s) => String(s)).join('/');
  // eslint-disable-next-line no-eval
  const req = eval('require') as NodeJS.Require;
  return req(joined);
}

/**
 * Pull a specific `.run*` (or staging.runStaging, dw.runEtl) symbol
 * out of a runtime-loaded script. The contract is "default-only"
 * so adapters don't have to know about ESM/CJS interop gymnastics.
 */
interface ScriptModule {
  scrapeMercadoLibre?: (config: SourceConfig) => Promise<ScrapeResult>;
  scrapeBooks?: (config: SourceConfig) => Promise<ScrapeResult>;
  scrapeTemu?: (config: SourceConfig) => Promise<ScrapeResult>;
  scrapeShein?: (config: SourceConfig) => Promise<ScrapeResult>;
  fetchExchangeRates?: (config: SourceConfig) => Promise<ScrapeResult>;
  loadCsvDataset?: (config: SourceConfig) => Promise<ScrapeResult>;
  loadEncuesta?: (config: SourceConfig) => Promise<ScrapeResult>;
  runStaging?: (opts?: StagingOptions) => Promise<StagingResult>;
  runEtl?: (prisma: PrismaClient, opts?: { stagingDir?: string; truncateFirst?: boolean }) => Promise<LoadResult>;
}

function loadScript(relativePath: string): ScriptModule {
  return runtimeRequire(pipelineScriptsDir(), ...relativePath.split('/')) as ScriptModule;
}

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */

/**
 * Run the staging → DW loader. Wraps `runEtl(prisma, opts)` from
 * `backend/pipeline/scripts/dw/dw_load_staging.ts`.
 */
export async function runEtlScript(
  prisma: PrismaClient,
  opts: { stagingDir?: string; truncateFirst?: boolean } = {},
): Promise<LoadResult> {
  const mod = loadScript('dw/dw_load_staging');
  if (!mod.runEtl) throw new Error('dw_load_staging.ts missing runEtl export');
  return mod.runEtl(prisma, opts);
}

/**
 * `runStaging` orchestrator. Reads `backend/pipeline/raw/`, emits
 * `backend/pipeline/staging/`.
 */
export async function runStagingScript(opts: StagingOptions = {}): Promise<StagingResult> {
  const mod = loadScript('staging/run_all');
  if (!mod.runStaging) throw new Error('run_all.ts missing runStaging export');
  return mod.runStaging(opts);
}

/**
 * MercadoLibre Ecuador scraper.
 */
export async function runMercadoLibreScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/mercadolibre');
  if (!mod.scrapeMercadoLibre) throw new Error('mercadolibre.ts missing scrapeMercadoLibre export');
  return mod.scrapeMercadoLibre(config);
}

/**
 * AliExpress (via books.toscrape.com) scraper.
 */
export async function runAliExpressScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/aliexpress');
  if (!mod.scrapeBooks) throw new Error('aliexpress.ts missing scrapeBooks export');
  return mod.scrapeBooks(config);
}

/**
 * Temu scraper (Chrome extension or quotes.toscrape.com fallback).
 */
export async function runTemuScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/temu');
  if (!mod.scrapeTemu) throw new Error('temu.ts missing scrapeTemu export');
  return mod.scrapeTemu(config);
}

/**
 * Shein scraper (Chrome extension or quotes.toscrape.com fallback).
 */
export async function runSheinScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/shein');
  if (!mod.scrapeShein) throw new Error('shein.ts missing scrapeShein export');
  return mod.scrapeShein(config);
}

/**
 * Exchange-rates API consumer.
 */
export async function runExchangeRatesScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/exchangerates');
  if (!mod.fetchExchangeRates) throw new Error('exchangerates.ts missing fetchExchangeRates export');
  return mod.fetchExchangeRates(config);
}

/**
 * CSV dataset loader (Kaggle or similar).
 */
export async function runCsvScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/load_csv');
  if (!mod.loadCsvDataset) throw new Error('load_csv.ts missing loadCsvDataset export');
  return mod.loadCsvDataset(config);
}

/**
 * Encuesta CSV loader (Google Forms export).
 */
export async function runEncuestaScrape(config: SourceConfig): Promise<ScrapeResult> {
  const mod = loadScript('scraping/load_encuesta');
  if (!mod.loadEncuesta) throw new Error('load_encuesta.ts missing loadEncuesta export');
  return mod.loadEncuesta(config);
}

/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
