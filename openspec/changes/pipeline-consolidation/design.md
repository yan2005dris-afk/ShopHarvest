# Design — Pipeline Consolidation

**Status:** Draft
**Branch:** `feat/bi-dashboard-analytics`
**Artifact store:** openspec
**Strict TDD:** false (Standard Mode — tests added alongside implementation per capability)

---

## 1. Architecture overview

The consolidation brings the scraping, staging, quality, and DW-load layers into the NestJS backend as first-class, statically-imported TypeScript modules under a new `pipeline/` module. Each source is a thin `IDataSource` adapter that statically imports a native scraping module; Playwright is funneled through a single injectable `BrowserFactoryService` (stealth always on, proxy opt-in); the extension-based sources consume a validated `extension_export.json`; and the staging/quality/DW phases are NestJS services bound to the existing `IStagingProcessor` and `IDwLoader` ports. The legacy `pipeline-scripts-bridge.ts` and `legacy/pipeline/scripts/` tree are removed; `legacy/` itself stays as archived evidence. The production build runs as `pnpm --filter backend build && node backend/dist/main.js` with zero runtime `.ts` loading and a CI grep guardrail that keeps the demo domains (`quotes.toscrape.com`, `books.toscrape.com`) out of the source tree.

```
backend/src/modules/pipeline/
│
├── pipeline.module.ts                       ─┐
│   providers:                                │
│     BrowserFactoryService                   │  registers the
│     StagingProcessorService                 │  singletons +
│     QualityService                          │  DI tokens
│     DwLoaderService                         │  (DATA_SOURCES,
│     MercadoLibreAdapter  (DATA_SOURCES)     │   STAGING_PROCESSOR,
│     AliExpressAdapter     (DATA_SOURCES)    │   DW_LOADER)
│     TemuAdapter          (DATA_SOURCES)    ─┘
│     SheinAdapter          (DATA_SOURCES)
│     ApiRatesAdapter      (DATA_SOURCES)
│     CsvAdapter           (DATA_SOURCES)
│     EncuestaAdapter      (DATA_SOURCES)
│     StagingProcessorAdapter (STAGING_PROCESSOR)
│     DwLoaderAdapter        (DW_LOADER)
│
├── scraping/                                 ─┐
│   ├── browser-factory.service.ts            │  Playwright +
│   ├── source-meta.ts                        │  stealth (always on)
│   ├── mercadolibre.ts                       │  + proxy (opt-in)
│   ├── aliexpress.ts                         │  via
│   ├── temu.ts            ─┐                 │  ConfigService
│   ├── shein.ts            │ extension flow  │
│   ├── exchange-rates.ts   │ (no Playwright) │
│   ├── csv-loader.ts       │                 │
│   └── encuesta-loader.ts ─┘                 │
│                                              │
├── etl/                                      │
│   ├── staging-processor.service.ts          │
│   ├── quality.service.ts                    │
│   ├── quality/checks/                       │
│   │   ├── required-fields.check.ts          │  7 checks
│   │   ├── price-positive.check.ts           │  (ported,
│   │   ├── currency-known.check.ts           │   not
│   │   ├── url-well-formed.check.ts          │   duplicated)
│   │   ├── category-nonempty.check.ts        │
│   │   ├── duplicate-product-id.check.ts     │
│   │   └── staging-row-count.check.ts        │
│   └── dw-loader.service.ts                  │
│                                              │
├── adapters/                                 │
│   ├── data-sources/                         │  thin wrappers
│   │   ├── meli.adapter.ts  ─────► scraping/mercadolibre
│   │   ├── ali.adapter.ts   ─────► scraping/aliexpress
│   │   ├── temu.adapter.ts  ─────► scraping/temu
│   │   ├── shein.adapter.ts ─────► scraping/shein
│   │   ├── api-rates.adapter.ts ► scraping/exchange-rates
│   │   ├── csv.adapter.ts   ─────► scraping/csv-loader
│   │   ├── encuesta.adapter.ts ──► scraping/encuesta-loader
│   │   ├── staging-processor.adapter.ts
│   │   └── dw-loader.adapter.ts
│   ├── staging-processor.adapter.ts  (delegates to etl/)
│   └── dw-loader.adapter.ts         (delegates to etl/)
│
├── etl-scheduler.service.ts                  │  cron trigger
├── pipeline.service.ts                       │  orchestrates
├── interfaces/                               │  ports (unchanged)
│   ├── data-source.interface.ts              │  IDataSource
│   ├── staging.interface.ts                  │  IStagingProcessor
│   └── dw.interface.ts                       │  IDwLoader
└── (DELETED) pipeline-scripts-bridge.ts     ✗
```

External coordination surface: `packages/contracts/pipeline/` is restored locally (deleted from disk, present in git HEAD) and exports the new symbols listed in §5. The Chrome extension writes `extension_export.json` to `EXTENSION_EXPORT_PATH`; the schema is pinned in the contracts package and validated by the Temu/Shein adapters.

---

## 2. Key decisions

### D1 — Singleton `BrowserFactoryService` vs per-adapter instantiation

**Topic:** Lifetime and ownership of the Playwright launcher.
**Choice:** **Singleton** NestJS `@Injectable()` registered in `PipelineModule.providers`. Module-scoped.
**Tradeoffs:**

- **+** `puppeteer-extra.use(stealth())` runs once per process — the registration is idempotent and tracked by a single `use()` call (BFS-3 / BFS-S3).
- **+** One place to read `SCRAPER_PROXY_SERVER` from `ConfigService` and to log `"WITH proxy <server>"` / `"WITHOUT proxy"` consistently.
- **+** MELI and AliExpress can be scheduled in offset cadence (e.g. `:00` and `:30`) and share a single stealth registration in memory.
- **−** Two adapters running in parallel still launch two Chromium processes — singleton is logical, not a browser pool. (Documented scheduler risk; not solved here.)
- **−** Singleton makes unit testing slightly more careful: tests must reset the registration guard between cases.
- **Rejected alternative:** per-adapter instantiation — duplicates the `use(stealth())` call per adapter, complicates proxy configuration drift, and bloats the chromium binary list with no upside.

### D2 — Stealth always-on vs opt-in (HARD RULE)

**Topic:** Whether `puppeteer-extra-plugin-stealth` is registered by default or behind a flag.
**Choice:** **Always on.** The plugin is registered in `BrowserFactoryService`'s module init exactly once; the service refuses to launch without it. There is no env var to disable stealth.
**Tradeoffs:**

- **+** Removes a configuration footgun: the default, no-config path is the one that works against MELI/AliExpress.
- **+** Mirrors the project hard rule from 2026-07-08: "stealth always on, proxy opt-in".
- **−** Slight test overhead — unit tests must stub the registration, not skip it.
- **−** Cannot run a "raw fingerprint" experiment against a target without forking the service.
- **Rejected alternative:** opt-in stealth — would let a misconfigured deployment scrape the real target with the default fingerprint and trip anti-bot detection immediately.

### D3 — Proxy opt-in via env var (HARD RULE)

**Topic:** When does a residential proxy get attached?
**Choice:** **Opt-in.** The service reads `SCRAPER_PROXY_SERVER`; if empty/undefined, no proxy is attached and a `"WITHOUT proxy"` log line is emitted (BFS-3 / BFS-S1). If set, the proxy is attached with the username template expanded: `{session}` replaced by a stable session id when `opts.stickySession: true`, otherwise stripped (rotating per launch) (BFS-4 / BFS-S2).
**Tradeoffs:**

- **+** Ships with zero vendor lock-in and zero mandatory subscription. The default run path is "no proxy, stealth only".
- **+** The `{session}` placeholder supports both rotating and sticky modes with the same configuration.
- **+** If `SCRAPER_PROXY_SERVER` is set without username/password, the service throws BEFORE launching — no half-proxied browsers (BFS-7).
- **−** Operators who already pay for a proxy must remember to set three env vars (`SERVER`, `USERNAME`, `PASSWORD`).
- **Rejected alternative:** proxy always on — would force every deployment to pay for a residential proxy vendor, contradicting the no-vendor procurement hard rule.

### D4 — 4-state `EtlRun` preserved, no DB migration (HARD RULE)

**Topic:** Whether the EtlRun state model gets touched.
**Choice:** **Preserve.** The Prisma enum stays `queued | running | success | failed`. The native services write those exact four values. `LoadResult.estado` (`completado | fallido`) is an adapter-level concept internal to the DW loader; it is mapped to the DB enum at the persistence boundary.
**Tradeoffs:**

- **+** No migration. Existing rows stay valid. The frontend's `etl-run-history-logs` capability keeps working without changes.
- **+** `dw.dim_fuente.nombre_fuente` ↔ `PipelineSource` alignment is documented as a unit test (ETL-6) so future sources can be added in lockstep.
- **−** The 3-state vs 4-state mismatch from the legacy scripts cannot be unified without breaking the schema. (Documented in proposal Risks; left as a follow-up.)
- **Rejected alternative:** collapse to 3 states — would require a migration and a frontend re-mapping; not worth the blast radius for a consolidation PR.

### D5 — Chained PR order: bridge → browser-factory → MELI/AliExpress → extension → ETL

**Topic:** Order of capability PRs on the single branch.
**Choice:** The chain order from the proposal's Approach section. PR 1 (`pipeline-bridge-elimination`) lands first because every later PR imports the native modules it creates. PR 2 (`browser-factory-stealth`) is the shared infra for PRs 3 and 4. PRs 3 and 4 (MELI, AliExpress) can land in either order after #2. PR 5 (`extension-based-sources`) is independent of Playwright. PR 6 (`etl-staging-dw-native`) is the last downstream consumer.
**Tradeoffs:**

- **+** Each PR compiles on its own — bridge deletion is the gate; later PRs add behavior, not delete it.
- **+** Rollback = `git revert` one PR. The bridge stays functional until PR 1's `node dist` test passes.
- **+** The two Playwright sources are independent of each other; review can swap them if one slips.
- **−** A long chain means 5+ merge events. Mitigation: keep each PR under the 400-line budget (see §6).
- **Rejected alternative:** mega-PR — would exceed 400 lines by an order of magnitude and break the Review Workload Guard.

### D6 — `legacy/` archived, `legacy/pipeline/scripts/` deleted (HARD RULE)

**Topic:** What happens to the `legacy/` directory.
**Choice:** **Archive `legacy/`, delete `legacy/pipeline/scripts/`.** Only the `pipeline/scripts/{scraping,staging,quality,dw}/` subtree is removed. Everything else inside `legacy/` (e.g. `legacy/packages/contracts/`, historical artifacts) stays as evidence of the prior deliverable. Verified by `git status` post-migration (ETL-7 / ETL-S5).
**Tradeoffs:**

- **+** No historical evidence is lost.
- **+** The migration surface is tight: 4 subfolders, all in `legacy/pipeline/scripts/`.
- **−** Rollback to pre-Phase-7 requires `git checkout HEAD~1 -- legacy/pipeline/scripts/` (documented in the proposal's Rollback Plan).
- **Rejected alternative:** delete all of `legacy/` — would destroy prior-deliverable evidence and break the audit trail.

### D7 — Grep guardrail in CI for demo domains

**Topic:** How to enforce "no demo fallback" mechanically.
**Choice:** A `rg` step in CI that runs against `backend/src/` and `legacy/`, fails the build on any hit for `quotes.toscrape.com` or `books.toscrape.com`, and another step that fails on `ts-node` or `eval('require')` (BRG-7 / BRG-S1).
**Tradeoffs:**

- **+** Mechanical, language-agnostic, zero runtime cost.
- **+** Catches reverts that sneak a demo URL back into a comment or a default constant.
- **+** The same guardrail covers both the bridge removal (no `ts-node`) and the demo-domain ban (no `quotes`/`books`).
- **−** Comments containing the strings (e.g. "removed `quotes.toscrape.com`") will trip it. Mitigation: comments must phrase it as `quotes[.]toscrape[.]com` or omit the literal host.
- **Rejected alternative:** review-only enforcement — relies on reviewer memory, fails on the first tired reviewer.

---

## 3. Backend file layout (concrete)

All paths are under `backend/src/modules/pipeline/` unless noted. `~N` = approximate new line count.

### `scraping/` (new, 8 files)

| File | Status | est_lines | Purpose |
| --- | --- | --- | --- |
| `browser-factory.service.ts` | NEW | ~80 | `@Injectable()` singleton; see §4 |
| `source-meta.ts` | NEW | ~40 | Per-source metadata; `mechanism: "playwright" \| "extension" \| "api" \| "file"` |
| `mercadolibre.ts` | NEW (moved) | ~180 | Port of `legacy/.../mercadolibre.ts` + `_base.ts`; uses `BrowserFactoryService` |
| `aliexpress.ts` | NEW (moved + retargeted) | ~190 | Port + retarget `books.toscrape.com` → `aliexpress.com`; lazy-load scroll; i18n |
| `temu.ts` | NEW (moved + rewritten) | ~110 | Read `extension_export.json`; throw `BadExtensionExportError` on miss/malformed |
| `shein.ts` | NEW (moved + rewritten) | ~110 | Same model as temu.ts |
| `exchange-rates.ts` | NEW (moved) | ~80 | axios call to public FX API; `API_KEY` from `ConfigService` |
| `csv-loader.ts` | NEW (moved) | ~70 | `csv-parse` file loader |
| `encuesta-loader.ts` | NEW (moved) | ~90 | `csv-parse` + anonymization helper |

Subtotal: ~950 lines across 9 files.

### `etl/` (new, 11 files)

| File | Status | est_lines | Purpose |
| --- | --- | --- | --- |
| `staging-processor.service.ts` | NEW | ~150 | Implements `IStagingProcessor`; reads `PIPELINE_RAW_DIR/<source>/<ts>.json` |
| `quality.service.ts` | NEW | ~120 | Aggregates 7 checks; returns `QualityReport`; uses NestJS `Logger` |
| `quality/checks/required-fields.check.ts` | NEW | ~25 | Check 1 of 7 |
| `quality/checks/price-positive.check.ts` | NEW | ~20 | Check 2 of 7 |
| `quality/checks/currency-known.check.ts` | NEW | ~25 | Check 3 of 7 |
| `quality/checks/url-well-formed.check.ts` | NEW | ~25 | Check 4 of 7 |
| `quality/checks/category-nonempty.check.ts` | NEW | ~20 | Check 5 of 7 |
| `quality/checks/duplicate-product-id.check.ts` | NEW | ~30 | Check 6 of 7 |
| `quality/checks/staging-row-count.check.ts` | NEW | ~25 | Check 7 of 7 |
| `dw-loader.service.ts` | NEW | ~180 | Implements `IDwLoader`; Prisma upserts into `dw.dim_fuente` + `dw.hecho_producto` |
| `etl.constants.ts` | NEW | ~20 | `SOURCE_MECHANISM_MAP` re-export + 4-state enum constants |

Subtotal: ~630 lines across 11 files.

### `adapters/` (modified, 9 files)

| File | Status | est_lines | Change |
| --- | --- | --- | --- |
| `data-sources/meli.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/mercadolibre`; drop bridge call |
| `data-sources/ali.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/aliexpress`; drop bridge call |
| `data-sources/temu.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/temu`; drop bridge call |
| `data-sources/shein.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/shein`; drop bridge call |
| `data-sources/api-rates.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/exchange-rates` |
| `data-sources/csv.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/csv-loader` |
| `data-sources/encuesta.adapter.ts` | MODIFIED | ~40 | Static `import` of `../scraping/encuesta-loader` |
| `staging-processor.adapter.ts` | MODIFIED | ~35 | Delegate to `etl/staging-processor.service` |
| `dw-loader.adapter.ts` | MODIFIED | ~35 | Delegate to `etl/dw-loader.service` |

Subtotal: ~350 lines across 9 files (most are ~20-line diffs against the current bridge-calling adapter).

### `pipeline.module.ts` (modified)

| File | Status | est_lines | Change |
| --- | --- | --- | --- |
| `pipeline.module.ts` | MODIFIED | +20 | Add `BrowserFactoryService`, `StagingProcessorService`, `QualityService`, `DwLoaderService` to `providers`. No token change. |

### Deleted files

| Path | Reason |
| --- | --- |
| `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` | BRG-1 — bridge retired |
| `legacy/pipeline/scripts/scraping/*.ts` (6 files) | Migrated to `backend/.../scraping/` |
| `legacy/pipeline/scripts/staging/*.ts` | Migrated to `etl/staging-processor.service.ts` |
| `legacy/pipeline/scripts/quality/*.ts` | Migrated to `etl/quality.service.ts` + `etl/quality/checks/` |
| `legacy/pipeline/scripts/dw/*.ts` | Migrated to `etl/dw-loader.service.ts` |
| `legacy/pipeline/scripts/` (the directory) | ETL-7 — empty after migration |

### Unchanged but co-located

- `pipeline.service.ts` — orchestrator; signature unchanged.
- `etl-scheduler.service.ts` — cron trigger; no behavior change beyond pointing at the already-DI-bound adapters.
- `interfaces/` — `IDataSource`, `IStagingProcessor`, `IDwLoader`, `SourceConfig`, `ScrapeResult`, `StagingResult`, `LoadResult` — port surface stays.
- `backend/package.json` — see §8.
- `packages/contracts/pipeline/` — restored from git HEAD; new symbols added (see §5).

**Grand total** (excluding `legacy/` deletion): ~1,930 new/modified lines across 30 files in `backend/`. Plus ~30 lines of net package.json changes.

---

## 4. BrowserFactoryService shape

The service lives at `backend/src/modules/pipeline/scraping/browser-factory.service.ts`. It is a NestJS `@Injectable()` singleton. It is the single source of truth for Playwright launches consumed by the MELI and AliExpress adapters (BFS-1, BFS-5).

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, BrowserContext } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { BrowserFactoryOptions } from '@web-scraping/contracts/pipeline';

const STEALTH_REGISTERED = Symbol.for('pipeline.stealth.registered');

@Injectable()
export class BrowserFactoryService implements OnModuleInit {
  private readonly logger = new Logger(BrowserFactoryService.name);
  private registered = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.ensureStealthRegistered();
  }

  private ensureStealthRegistered(): void {
    if (this.registered) return;
    const g = globalThis as unknown as Record<symbol, boolean>;
    if (g[STEALTH_REGISTERED]) {
      this.registered = true;
      return;
    }
    chromium.use(stealth());
    g[STEALTH_REGISTERED] = true;
    this.registered = true;
    this.logger.log('stealth plugin registered (singleton)');
  }

  async launch(opts: BrowserFactoryOptions = {}): Promise<Browser> {
    this.ensureStealthRegistered();

    const headless = this.config.get<string>('SCRAPER_HEADLESS', 'true') === 'true';
    const proxyServer = this.config.get<string>('SCRAPER_PROXY_SERVER', '').trim();
    const proxyUser = this.config.get<string>('SCRAPER_PROXY_USERNAME', '');
    const proxyPass = this.config.get<string>('SCRAPER_PROXY_PASSWORD', '');

    if (!proxyServer) {
      this.logger.log('launching browser WITHOUT proxy');
      return chromium.launch({ headless });
    }

    if (!proxyUser || !proxyPass) {
      throw new Error(
        'SCRAPER_PROXY_SERVER is set but SCRAPER_PROXY_USERNAME or SCRAPER_PROXY_PASSWORD is missing',
      );
    }

    const sessionId = opts.stickySession ? `session-${Date.now()}` : '';
    const username = proxyUser.replace('{session}', sessionId);

    this.logger.log(`launching browser WITH proxy ${proxyServer} (sticky=${!!opts.stickySession})`);
    return chromium.launch({
      headless,
      proxy: { server: proxyServer, username, password: proxyPass },
    });
  }

  async newContext(browser: Browser, opts: BrowserFactoryOptions = {}): Promise<BrowserContext> {
    const proxyServer = this.config.get<string>('SCRAPER_PROXY_SERVER', '').trim();
    const contextOpts: Parameters<Browser['newContext']>[0] = {
      viewport: opts.viewport ?? { width: 1366, height: 768 },
      userAgent: opts.userAgent,
      locale: opts.locale ?? 'en-US',
    };
    if (proxyServer) {
      const proxyUser = this.config.get<string>('SCRAPER_PROXY_USERNAME', '');
      const proxyPass = this.config.get<string>('SCRAPER_PROXY_PASSWORD', '');
      const sessionId = opts.stickySession ? `session-${Date.now()}` : '';
      contextOpts.proxy = {
        server: proxyServer,
        username: proxyUser.replace('{session}', sessionId),
        password: proxyPass,
      };
    }
    return browser.newContext(contextOpts);
  }
}
```

**Notes:**

- The `Symbol.for('pipeline.stealth.registered')` global guard survives multiple NestJS module rebuilds in the same process and is the primary defense against the "registration is a no-op the second time" requirement (BFS-S3).
- `OnModuleInit` calls the registration eagerly; `launch()` also calls it as a safety net for lazy bootstraps (NFR: "module init vs lazy init").
- The two log lines — `WITHOUT proxy` and `WITH proxy <server>` — are literal substrings the spec asserts on (BFS-3, BFS-4, BFS-S1, BFS-S2).
- `BrowserFactoryOptions` is defined in the contracts package (see §5); the service does not own its shape.

---

## 5. Contracts in `@web-scraping/contracts/pipeline`

New symbols added to `packages/contracts/src/pipeline/`. Existing types (`PipelineSource`, `ScrapeResult`, `SourceConfig`, `IStagingProcessor`, `IDwLoader`) stay unchanged.

### `source-mechanism.ts`

```ts
export type SourceMechanism = 'playwright' | 'extension' | 'api' | 'file';

export const SOURCE_MECHANISM_MAP: Record<string, SourceMechanism> = {
  meli: 'playwright',
  ali: 'playwright',
  temu: 'extension',
  shein: 'extension',
  api_rates: 'api',
  csv: 'file',
  encuesta: 'file',
};
```

### `extension-export.ts`

```ts
export interface ExtensionExportProduct {
  productId: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  url: string;
}

export interface ExtensionExport {
  source: 'temu' | 'shein';
  capturedAt: string; // ISO-8601
  products: ExtensionExportProduct[];
}
```

### `bad-extension-export.error.ts`

```ts
export class BadExtensionExportError extends Error {
  constructor(
    public readonly reason: 'missing' | 'schema' | 'parse',
    public readonly detail?: string,
  ) {
    super(`extension_export.json invalid: ${reason}${detail ? ` — ${detail}` : ''}`);
    this.name = 'BadExtensionExportError';
  }
}
```

### `browser-factory-options.ts`

```ts
export interface BrowserFactoryOptions {
  stickySession?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
}
```

### `scraper-metrics.ts`

```ts
export interface ScraperMetrics {
  items: number;
  durationMs: number;
  retries: number;
  state: 'success' | 'failed';
}
```

### `etl-run-state.ts`

```ts
export type EtlRunState = 'queued' | 'running' | 'success' | 'failed';

export const ETL_RUN_STATES: readonly EtlRunState[] = [
  'queued',
  'running',
  'success',
  'failed',
] as const;
```

All seven files land in `packages/contracts/src/pipeline/` and are re-exported from `packages/contracts/src/pipeline/index.ts`. The package is restored locally (BRG-8) from git HEAD; the new symbols are added in PR 2 (`browser-factory-stealth`) for `BrowserFactoryOptions` and in PR 5 (`extension-based-sources`) for the extension types.

---

## 6. Chained PR plan

> **User-confirmed (2026-07-08):** PR 1 is split defensively (1a + 1b). PR 5 and PR 6 stay **unified** even though they exceed the 400-line soft cap. Final shape: **8 PRs** (1a, 1b, 2, 3, 4, 5, 6) — see plan below.

Eight PRs, all targeting `feat/bi-dashboard-analytics`. Each PR compiles green on its own; no PR depends on a future PR.

### PR 1a — `pipeline-bridge-elimination/foundation` (split defensively)

**Goal:** Bridge deleted; contracts restored; CI grep guardrail in place. Stubs only on the scraping modules (no full implementations yet — those land in PR 1b).
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` | DELETED | −150 |
| `packages/contracts/` | RESTORED | +0 (git checkout) |
| `.github/workflows/ci.yml` | MODIFIED | +20 (grep step) |
| `backend/src/modules/pipeline/pipeline.module.ts` | MODIFIED | +5 (drop bridge import) |
| `backend/src/modules/pipeline/pipeline.service.ts` | MODIFIED | +10 (drop bridge calls) |
| `backend/src/modules/pipeline/scraping/.gitkeep` | NEW | +0 |
| **Total** | | **~+35 / −150** |

**Merge dependencies:** none.
**Verdict:** **within_budget** — tiny diff. The grep guardrail (CI) is the only new logic. **This PR can land even with stubs** because the deleted bridge is what was broken; the new modules are placeholders.

### PR 1b — `pipeline-bridge-elimination/scraping-modules` (split defensively)

**Goal:** Land 7 native scraping modules + 7 adapter rewrites + delete `legacy/pipeline/scripts/`. This is the heavy lift of the original PR 1.
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/scraping/mercadolibre.ts` | NEW (stub) | +30 |
| `backend/src/modules/pipeline/scraping/aliexpress.ts` | NEW (stub) | +30 |
| `backend/src/modules/pipeline/scraping/temu.ts` | NEW (stub) | +25 |
| `backend/src/modules/pipeline/scraping/shein.ts` | NEW (stub) | +25 |
| `backend/src/modules/pipeline/scraping/exchange-rates.ts` | NEW (stub) | +25 |
| `backend/src/modules/pipeline/scraping/csv-loader.ts` | NEW (stub) | +20 |
| `backend/src/modules/pipeline/scraping/encuesta-loader.ts` | NEW (stub) | +25 |
| `backend/src/modules/pipeline/scraping/source-meta.ts` | NEW | +40 |
| `backend/src/modules/pipeline/adapters/data-sources/*.adapter.ts` (×7) | MODIFIED | +20 each (×7) |
| `backend/package.json` | MODIFIED | +10 |
| `backend/.env.example` | MODIFIED | +10 |
| `legacy/pipeline/scripts/{scraping,staging,quality,dw}/` | DELETED | −600 |
| **Total** | | **~+295 / −600** |

**Merge dependencies:** PR 1a.
**Verdict:** **within_budget** — net ~300 lines across 14 files. The scraping modules are stubs (interface signature + `throw new Error('not implemented, see PR 3/4/5')` body) so the diff is small. Real implementations land in PR 3 (MELI), PR 4 (AliExpress), PR 5 (Temu/Shein). Full `nest build && node dist` runs end-to-end because the stubs return early without crashing.

### PR 2 — `browser-factory-stealth` (shared infra)

**Goal:** Singleton service + always-on stealth + proxy opt-in; no adapter uses it yet.
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/scraping/browser-factory.service.ts` | NEW | +80 |
| `packages/contracts/src/pipeline/browser-factory-options.ts` | NEW | +15 |
| `packages/contracts/src/pipeline/index.ts` | MODIFIED | +5 |
| `backend/src/modules/pipeline/pipeline.module.ts` | MODIFIED | +10 |
| `backend/src/modules/pipeline/scraping/__tests__/browser-factory.service.spec.ts` | NEW | +120 |
| **Total** | | **~+230** |

**Merge dependencies:** PR 1.
**Verdict:** **within_budget** (230 lines, single concern).

### PR 3 — `mercadolibre-real-scraper` (Playwright source #1)

**Goal:** Native `MercadoLibreAdapter` targets `mercadolibre.com.ec`; retries + metrics + EtlRun row.
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/scraping/mercadolibre.ts` | REPLACED (full impl) | +260 |
| `backend/src/modules/pipeline/adapters/data-sources/meli.adapter.ts` | MODIFIED | +20 |
| `packages/contracts/src/pipeline/scraper-metrics.ts` | NEW | +15 |
| `packages/contracts/src/pipeline/index.ts` | MODIFIED | +3 |
| `backend/src/modules/pipeline/scraping/__tests__/mercadolibre.spec.ts` | NEW | +140 |
| **Total** | | **~+440** |

**Merge dependencies:** PR 1, PR 2.
**Verdict:** **at_budget** — 440 lines is right at the 400-line soft cap. The `mercadolibre.ts` rewrite from the bridge-stub port in PR 1 is what makes this near the cap. Acceptable for one PR; if a reviewer requests a split, the `scraper-metrics.ts` and unit test can move to a follow-up PR without blocking the main flow.

### PR 4 — `aliexpress-real-scraper` (Playwright source #2)

**Goal:** Native `AliExpressAdapter` targets `aliexpress.com`; lazy-load scroll; i18n handling.
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/scraping/aliexpress.ts` | REPLACED (full impl) | +270 |
| `backend/src/modules/pipeline/adapters/data-sources/ali.adapter.ts` | MODIFIED | +20 |
| `backend/src/modules/pipeline/scraping/__tests__/aliexpress.spec.ts` | NEW | +150 |
| **Total** | | **~+440** |

**Merge dependencies:** PR 1, PR 2.
**Verdict:** **at_budget** — same shape as PR 3. Can land in parallel with PR 3 only if isolated worktrees are approved; otherwise sequenced after PR 3.

### PR 5 — `extension-based-sources` (Temu + Shein, independent, **unified per user decision**)

**Goal:** Native `TemuAdapter` + `SheinAdapter` consume `extension_export.json`; no demo fallback.
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/scraping/temu.ts` | REPLACED | +130 |
| `backend/src/modules/pipeline/scraping/shein.ts` | REPLACED | +130 |
| `backend/src/modules/pipeline/adapters/data-sources/temu.adapter.ts` | MODIFIED | +20 |
| `backend/src/modules/pipeline/adapters/data-sources/shein.adapter.ts` | MODIFIED | +20 |
| `packages/contracts/src/pipeline/source-mechanism.ts` | NEW | +20 |
| `packages/contracts/src/pipeline/extension-export.ts` | NEW | +30 |
| `packages/contracts/src/pipeline/bad-extension-export.error.ts` | NEW | +25 |
| `packages/contracts/src/pipeline/index.ts` | MODIFIED | +10 |
| `backend/src/modules/pipeline/scraping/__tests__/temu.spec.ts` | NEW | +90 |
| `backend/src/modules/pipeline/scraping/__tests__/shein.spec.ts` | NEW | +90 |
| **Total** | | **~+565** |

**Merge dependencies:** PR 1b (only — independent of Playwright work).
**Verdict:** **at_budget (unified per user decision 2026-07-08)** — 565 lines exceeds the 400-line soft cap by 41%, but the user accepted the larger PR for this phase. Reviewer should batch: contracts (3 files, ~85 lines) first, then the two adapter rewrites (Temu + Shein, symmetric, can be reviewed side by side). If review load is high, the original split (5a contracts + 5b adapters) is still documented above.

### PR 6 — `etl-staging-dw-native` (downstream, **unified per user decision**)

**Goal:** Native `StagingProcessorService` + `QualityService` + `DwLoaderService`; legacy ETL scripts gone.
**Files touched:**

| Path | Status | est_lines |
| --- | --- | --- |
| `backend/src/modules/pipeline/etl/staging-processor.service.ts` | NEW | +150 |
| `backend/src/modules/pipeline/etl/quality.service.ts` | NEW | +120 |
| `backend/src/modules/pipeline/etl/quality/checks/required-fields.check.ts` | NEW | +25 |
| `backend/src/modules/pipeline/etl/quality/checks/price-positive.check.ts` | NEW | +20 |
| `backend/src/modules/pipeline/etl/quality/checks/currency-known.check.ts` | NEW | +25 |
| `backend/src/modules/pipeline/etl/quality/checks/url-well-formed.check.ts` | NEW | +25 |
| `backend/src/modules/pipeline/etl/quality/checks/category-nonempty.check.ts` | NEW | +20 |
| `backend/src/modules/pipeline/etl/quality/checks/duplicate-product-id.check.ts` | NEW | +30 |
| `backend/src/modules/pipeline/etl/quality/checks/staging-row-count.check.ts` | NEW | +25 |
| `backend/src/modules/pipeline/etl/dw-loader.service.ts` | NEW | +180 |
| `backend/src/modules/pipeline/etl/etl.constants.ts` | NEW | +20 |
| `backend/src/modules/pipeline/adapters/staging-processor.adapter.ts` | MODIFIED | +20 |
| `backend/src/modules/pipeline/adapters/dw-loader.adapter.ts` | MODIFIED | +20 |
| `backend/src/modules/pipeline/pipeline.module.ts` | MODIFIED | +10 |
| `backend/src/modules/pipeline/etl/__tests__/quality.service.spec.ts` | NEW | +100 |
| `backend/src/modules/pipeline/etl/__tests__/staging-processor.service.spec.ts` | NEW | +100 |
| **Total** | | **~+890** |

**Merge dependencies:** PR 1b (the new scraping modules must exist so staging has raw to read).
**Verdict:** **at_budget (unified per user decision 2026-07-08)** — 890 lines is more than 2× the 400-line cap. The user accepted the larger PR for this phase. Reviewer should batch in 3 groups: (1) the 7 quality checks (~190 lines, ~25 each, symmetric), (2) `quality.service.ts` + `staging-processor.service.ts` (~270 lines, orchestration), (3) `dw-loader.service.ts` + adapter wiring (~220 lines, Prisma + DI). The original split (6a quality + 6b staging + 6c dw-loader) is still documented above if the user reconsiders during review.

---

## 7. Environment variables

| Variable | Default | Controls | Required by PR |
| --- | --- | --- | --- |
| `SCRAPER_PROXY_SERVER` | (empty) | If set, `BrowserFactoryService` attaches a residential proxy. If empty/unset, browser runs WITHOUT proxy. | PR 2 |
| `SCRAPER_PROXY_USERNAME` | (empty) | Username template; `{session}` placeholder replaced when `opts.stickySession: true`, otherwise stripped (rotating). | PR 2 |
| `SCRAPER_PROXY_PASSWORD` | (empty) | Proxy password. If `SCRAPER_PROXY_SERVER` is set and this is missing, the service throws BEFORE launch. | PR 2 |
| `SCRAPER_HEADLESS` | `true` | `chromium.launch({ headless })`. Set to `false` for headed runs during local debugging. | PR 2 |
| `PIPELINE_RAW_DIR` | `backend/pipeline/raw` | Where scrapers write `${source}/${timestamp}.json`. Resolved via `ConfigService`; never `process.cwd()`. | PR 1 |
| `PIPELINE_STAGING_DIR` | `backend/pipeline/staging` | Where `StagingProcessorService` writes staging rows. | PR 6 |
| `EXTENSION_EXPORT_PATH` | `backend/pipeline/extension/extension_export.json` | Where Temu/Shein adapters read `extension_export.json`. | PR 5 |

Variables are added to `backend/.env.example` in PR 1 (the first PR that touches the env file) with comments explaining the opt-in semantics.

---

## 8. Dependency additions

`backend/package.json` runtime + dev additions:

| Package | Version range | Purpose | PR |
| --- | --- | --- | --- |
| `playwright` | `^1.45.0` | Browser automation; the `chromium` binary family. | PR 1 (imported via `playwright-extra`); PR 3/4 use it directly |
| `playwright-extra` | `^4.3.6` | Stealth-friendly wrapper around Playwright. | PR 2 |
| `puppeteer-extra-plugin-stealth` | `^2.11.2` | Stealth plugin (always on, per hard rule). | PR 2 |
| `axios` | `^1.7.0` | `exchange-rates.ts` and any future HTTP scrapers. | PR 1 |
| `csv-parse` | `^5.5.6` | `csv-loader.ts` + `encuesta-loader.ts`. | PR 1 |
| `zod` | `^3.23.0` | Strict schema validation for `extension_export.json` (pinned in contracts). | PR 5 |

**Post-install:** `pnpm exec playwright install chromium --with-deps` must run in the backend Dockerfile and in CI setup. Documented in the backend README (PR 1).

No removal of existing dependencies is required. `worker/` is untouched.

---

## 9. Grep guardrail + build gate

The CI step in `.github/workflows/ci.yml` enforces three rules. Any hit fails the build.

```yaml
- name: Pipeline consolidation guardrails
  run: |
    set -e
    # Rule 1: no demo fallback
    if rg -n 'quotes\.toscrape\.com|books\.toscrape\.com' backend/src/ legacy/; then
      echo "::error::demo domain reference found — quotes.toscrape.com or books.toscrape.com is banned"
      exit 1
    fi
    # Rule 2: no ts-node / eval('require') in backend
    if rg -n "ts-node|eval\('require'\)" backend/src/; then
      echo "::error::ts-node or eval('require') found in backend — bridge re-introduced"
      exit 1
    fi
    # Rule 3: BrowserFactoryService must not leak into extension adapters
    if rg -n 'BrowserFactoryService' backend/src/modules/pipeline/scraping/temu.ts backend/src/modules/pipeline/scraping/shein.ts; then
      echo "::error::BrowserFactoryService referenced from an extension-based adapter"
      exit 1
    fi
```

**Build gate for PR 1 merge:**

```yaml
- name: Backend production build + boot smoke
  working-directory: backend
  run: |
    pnpm install --frozen-lockfile
    pnpm build
    node dist/main.js --smoke-run    # exits 0 after a no-op boot
```

The `--smoke-run` flag (added to `main.ts` in PR 1) makes the server boot, initialize all providers, and exit cleanly with code 0 — confirming the bridge is gone and all DI bindings resolve. It does NOT trigger the cron or scrape anything.

PR 2 adds unit tests for `BrowserFactoryService` that cover BFS-S1, BFS-S2, BFS-S3, BFS-S4. PR 3 and PR 4 add adapter-specific unit tests for the retry/metrics logic (MELI-S2, MELI-S3, ALI-S3, ALI-S4). PR 5 adds adapter tests for EXT-S1 through EXT-S5. PR 6 adds ETL service tests for ETL-S1, ETL-S2, ETL-S3, ETL-S4, ETL-S5.

---

## 10. Spec traceability matrix

| Spec req | Spec file | File path | PR |
| --- | --- | --- | --- |
| **BRG-1** bridge deleted | `pipeline-bridge-elimination/spec.md` §3 | `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` (DELETED) | PR 1 |
| **BRG-2** no `ts-node` / `eval('require')` | `pipeline-bridge-elimination/spec.md` §3 | CI guardrail + all adapter rewrites in `backend/src/modules/pipeline/adapters/data-sources/` | PR 1 |
| **BRG-3** static `import` per adapter | `pipeline-bridge-elimination/spec.md` §3 | `backend/src/modules/pipeline/adapters/data-sources/*.adapter.ts` | PR 1 |
| **BRG-4** 7 native modules under `scraping/` | `pipeline-bridge-elimination/spec.md` §3 | `backend/src/modules/pipeline/scraping/{mercadolibre,aliexpress,temu,shein,exchange-rates,csv-loader,encuesta-loader}.ts` | PR 1 |
| **BRG-5** `legacy/pipeline/scripts/` removed | `pipeline-bridge-elimination/spec.md` §3 | git delete of `legacy/pipeline/scripts/` | PR 1 |
| **BRG-6** `pnpm build && node dist` runs | `pipeline-bridge-elimination/spec.md` §3 | `.github/workflows/ci.yml` build gate | PR 1 |
| **BRG-7** grep guardrail in CI | `pipeline-bridge-elimination/spec.md` §3, §4 | `.github/workflows/ci.yml` | PR 1 |
| **BRG-8** `@web-scraping/contracts` restored | `pipeline-bridge-elimination/spec.md` §3 | `packages/contracts/` (git checkout HEAD) | PR 1 |
| **BRG-9** no legacy-fallback fixtures | `pipeline-bridge-elimination/spec.md` §3 | review-only; CI grep covers the runtime surface | PR 1 |
| **BFS-1** `@Injectable()` singleton | `browser-factory-stealth/spec.md` §3 | `backend/src/modules/pipeline/scraping/browser-factory.service.ts` | PR 2 |
| **BFS-2** stealth registered once | `browser-factory-stealth/spec.md` §3 | `ensureStealthRegistered()` + `Symbol.for(...)` global guard | PR 2 |
| **BFS-3** empty proxy → `"WITHOUT proxy"` | `browser-factory-stealth/spec.md` §3 | `launch()` early-return branch | PR 2 |
| **BFS-4** set proxy → `"WITH proxy <server>"` | `browser-factory-stealth/spec.md` §3 | `launch()` proxy branch + `{session}` expansion | PR 2 |
| **BFS-5** only MELI/Ali inject | `browser-factory-stealth/spec.md` §3 | `pipeline.module.ts` providers list; CI grep guardrail | PR 2 + PR 5 (grep) |
| **BFS-6** `SCRAPER_HEADLESS` honored | `browser-factory-stealth/spec.md` §3 | `launch()` reads `ConfigService` | PR 2 |
| **BFS-7** missing username/password → throw | `browser-factory-stealth/spec.md` §3 | pre-launch validation in `launch()` | PR 2 |
| **MELI-1** targets `mercadolibre.com.ec` | `mercadolibre-real-scraper/spec.md` §3 | `backend/src/modules/pipeline/scraping/mercadolibre.ts` | PR 3 |
| **MELI-2** browser via `BrowserFactoryService` | `mercadolibre-real-scraper/spec.md` §3 | `MercadoLibreAdapter` | PR 3 |
| **MELI-3** exponential backoff retries | `mercadolibre-real-scraper/spec.md` §3 | retry loop in `mercadolibre.ts` | PR 3 |
| **MELI-4** metrics in `ScrapeResult` + Logger | `mercadolibre-real-scraper/spec.md` §3 | `ScraperMetrics` + NestJS `Logger.log` | PR 3 |
| **MELI-5** raw path via `PIPELINE_RAW_DIR` | `mercadolibre-real-scraper/spec.md` §3 | `path.join(PIPELINE_RAW_DIR, 'meli', ...)` | PR 3 |
| **MELI-6** EtlRun row inserted | `mercadolibre-real-scraper/spec.md` §3 | Prisma `etlRun.create` | PR 3 |
| **MELI-7** `> 0` items gate | `mercadolibre-real-scraper/spec.md` §3 | count check in `mercadolibre.ts` | PR 3 |
| **MELI-8** anti-bot challenge → retryable | `mercadolibre-real-scraper/spec.md` §3 | challenge classifier + retry branch | PR 3 |
| **ALI-1** targets `aliexpress.com` | `aliexpress-real-scraper/spec.md` §3 | `backend/src/modules/pipeline/scraping/aliexpress.ts` | PR 4 |
| **ALI-2** browser via `BrowserFactoryService` | `aliexpress-real-scraper/spec.md` §3 | `AliExpressAdapter` | PR 4 |
| **ALI-3** i18n/geo redirect | `aliexpress-real-scraper/spec.md` §3 | initial navigation + region re-route | PR 4 |
| **ALI-4** lazy-load scroll | `aliexpress-real-scraper/spec.md` §3 | `window.scrollTo` loop with `MAX_SCROLLS` cap | PR 4 |
| **ALI-5** retry on transient failures | `aliexpress-real-scraper/spec.md` §3 | retry loop with backoff | PR 4 |
| **ALI-6** raw path via `PIPELINE_RAW_DIR` | `aliexpress-real-scraper/spec.md` §3 | `path.join` against `ConfigService` | PR 4 |
| **ALI-7** `> 0` items gate | `aliexpress-real-scraper/spec.md` §3 | count check | PR 4 |
| **ALI-8** EtlRun row | `aliexpress-real-scraper/spec.md` §3 | Prisma `etlRun.create` | PR 4 |
| **EXT-1** read `extension_export.json` via env | `extension-based-sources/spec.md` §3 | `temu.ts` + `shein.ts` use `EXTENSION_EXPORT_PATH` | PR 5 |
| **EXT-2** missing file → `BadExtensionExportError("missing")` | `extension-based-sources/spec.md` §3 | `temu.ts` / `shein.ts` pre-read check | PR 5 |
| **EXT-3** malformed JSON / schema → `BadExtensionExportError("schema")` | `extension-based-sources/spec.md` §3 | zod validator entry point | PR 5 |
| **EXT-4** no Playwright/stealth in adapters | `extension-based-sources/spec.md` §3 | CI grep guardrail | PR 5 (enforced) |
| **EXT-5** no `BrowserFactoryService` | `extension-based-sources/spec.md` §3 | CI grep guardrail | PR 2 + PR 5 |
| **EXT-6** raw payload persisted as-is | `extension-based-sources/spec.md` §3 | `fs.writeFile` to `PIPELINE_RAW_DIR/<source>/<capturedAt>.json` | PR 5 |
| **EXT-7** `source-meta.ts` with `mechanism: "extension"` | `extension-based-sources/spec.md` §3 | `backend/src/modules/pipeline/scraping/source-meta.ts` | PR 1 (stub) + PR 5 (filled) |
| **EXT-8** no demo domain strings | `extension-based-sources/spec.md` §3, §5 | CI grep guardrail | PR 5 (enforced) |
| **ETL-1** `StagingProcessorService` implements `IStagingProcessor` | `etl-staging-dw-native/spec.md` §3 | `backend/src/modules/pipeline/etl/staging-processor.service.ts` | PR 6 |
| **ETL-2** `DwLoaderService` upserts via Prisma | `etl-staging-dw-native/spec.md` §3 | `backend/src/modules/pipeline/etl/dw-loader.service.ts` | PR 6 |
| **ETL-3** 7 quality checks via NestJS `Logger` | `etl-staging-dw-native/spec.md` §3 | `backend/src/modules/pipeline/etl/quality.service.ts` + `quality/checks/*.check.ts` | PR 6 |
| **ETL-4** fail-fast on any failed check | `etl-staging-dw-native/spec.md` §3 | `QualityReport` aggregation; short-circuits `DwLoaderService` | PR 6 |
| **ETL-5** 4-state EtlRun preserved | `etl-staging-dw-native/spec.md` §3 | Prisma enum values written by all 3 services | PR 6 (enforced by unit test) |
| **ETL-6** `nombre_fuente` ↔ `PipelineSource` aligned | `etl-staging-dw-native/spec.md` §3 | unit test in `dw-loader.service.spec.ts` | PR 6 |
| **ETL-7** `legacy/pipeline/scripts/{staging,quality,dw}/` deleted | `etl-staging-dw-native/spec.md` §3 | git delete | PR 6 |

---

## Open questions for the user (resolved at design time)

1. **Should the grep guardrail also block `process.cwd()` in the backend?** The proposal says "no hardcoded `process.cwd()` paths in the consolidated adapters". I have NOT added a `process.cwd()` grep step; it would also hit legitimate uses (e.g. in `main.ts` for `__dirname` resolution). The MELI-5, ALI-6, EXT-1 specs each pin a specific behavior; the grep step is a soft check, not a CI gate. If you want a hard gate, I can add a targeted `rg "process\.cwd\(\)" backend/src/modules/pipeline/scraping/` step in PR 1.
2. **PR 1 split? My audit says 490 net new lines is within_budget**, but the bridge is the foundation. If you want extra safety, the recommended split is: (a) "delete bridge + restore contracts" (~−750 lines net), (b) "land 7 native scraping modules + adapter rewrites" (~+870 lines). That second sub-PR is over the cap; the alternative is to keep PR 1 as a single ~500-line PR and let review batch through the new files.
3. **PR 5 split is recommended (565 lines).** I have proposed PR 5a (contracts) and PR 5b (adapters) but kept it as a soft recommendation. The Temu/Shein adapters share so much logic that a 5b that ships both is denser than 5b-temu + 5b-shein separately. Confirm preferred granularity before PR 5 starts.
4. **PR 6 split is recommended (890 lines).** I have proposed 6a (quality) / 6b (staging) / 6c (dw-loader). Confirm or push back before PR 6 starts.
