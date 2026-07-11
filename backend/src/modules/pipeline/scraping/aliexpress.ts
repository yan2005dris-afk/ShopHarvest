/**
 * Scraper — AliExpress (native NestJS, no bridge).
 *
 * Replaces the legacy `scripts/scraping/aliexpress.ts` (deleted in
 * PR 1b), which targeted a demo book-catalog site instead of a real
 * marketplace. Targets the real `aliexpress.com` marketplace. Uses BrowserFactoryService
 * for stealth + optional proxy, detects the locale/region redirect
 * on first navigation, lazy-loads results via incremental scroll,
 * retries with exponential backoff on transient failures (network,
 * 403, anti-bot challenge), and writes raw JSON to PIPELINE_RAW_DIR.
 *
 * Wire contract: returns `ScrapeResult` (per IDataSource) with the
 * `ScraperMetrics` payload attached at `result.metrics`. PR 6's
 * persistence layer reads `result.metrics` to populate `EtlRun`.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Page, Response, BrowserContext } from 'playwright';
import type {
  ScrapeResult,
  SourceConfig,
  ScraperMetrics,
} from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { BrowserFactoryService } from './browser-factory.service';

const DEFAULT_REGION = 'www.aliexpress.com';
const DEFAULT_ACCEPT_LANGUAGE = 'es-EC,es;q=0.9,en;q=0.8';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const NAV_TIMEOUT_MS = 30000;
const DEFAULT_MAX_SCROLLS = 8;
const SCROLL_INCREMENT_PX = 1200;
const SCROLL_PAUSE_MS = 1200;
const MAX_ITEMS_PER_CATEGORY = 60;

const CATEGORIES: ReadonlyArray<{ path: string; label: string }> = [
  { path: '/', label: 'home' },
  {
    path: '/wholesale?SearchText=electronics',
    label: 'electronics',
  },
];

const ITEM_SELECTORS = [
  '.search-item-card-wrapper-gallery',
  '[data-product-id]',
  '.product-snippet-content',
  'a.search-card-item',
];

/** Markers observed on AliExpress's anti-bot / slider-captcha interstitial. */
const CAPTCHA_MARKERS = [
  'punish',
  'nc_1_n1z',
  'verify you are a human',
  'slider to verify',
];

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'stylesheet', 'font']);

export interface ScrapeAliExpressOptions {
  /** Maximum number of retry attempts per category after the first try. */
  maxRetries?: number;
  /** Base backoff in ms; doubled per attempt, capped at 30s. */
  retryBaseMs?: number;
  /** Scroll pause in ms after each increment (default 1200). Lower for tests. */
  scrollPauseMs?: number;
  /** Hard cap on lazy-load scroll iterations (default 8). */
  maxScrolls?: number;
}

/**
 * Scrape AliExpress.
 *
 * - `config.outputDir` is honored if absolute; if relative, it's joined
 *   with the resolved `PIPELINE_RAW_DIR` env var (NOT process.cwd()).
 * - `config.maxItems` hard-caps the resulting items array.
 * - `config.extra.region` (optional) overrides the default
 *   `www.aliexpress.com` region host (e.g. `es.aliexpress.com`).
 * - `opts.maxRetries` / `opts.retryBaseMs` / `opts.maxScrolls` override
 *   the default retry and lazy-load policy.
 *
 * Returns a `ScrapeResult` with the total items, output path, duration,
 * metrics, and a list of non-fatal errors. Retries on HTTP 4xx/5xx,
 * anti-bot challenge markers, and Playwright-level navigation errors
 * up to N times with exponential backoff. After retries are exhausted,
 * the error is recorded in `errors[]` and the run continues with the
 * next category.
 */
export async function scrapeAliExpress(
  config: SourceConfig,
  browserFactory: BrowserFactoryService,
  configService: ConfigService,
  opts: ScrapeAliExpressOptions = {},
): Promise<ScrapeResult> {
  const logger = new Logger('scrapeAliExpress');
  const start = Date.now();
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseMs = opts.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  const scrollPauseMs = opts.scrollPauseMs ?? SCROLL_PAUSE_MS;
  const maxScrolls = opts.maxScrolls ?? DEFAULT_MAX_SCROLLS;

  const region =
    typeof config.extra?.['region'] === 'string'
      ? config.extra['region']
      : DEFAULT_REGION;
  const acceptLanguage =
    typeof config.extra?.['acceptLanguage'] === 'string'
      ? config.extra['acceptLanguage']
      : DEFAULT_ACCEPT_LANGUAGE;

  const rawDir = resolveRawDir(config, configService);
  const maxItems = config.maxItems ?? MAX_ITEMS_PER_CATEGORY;

  const browser = await browserFactory.launch({ acceptLanguage });
  const context = await browserFactory.newContext(browser, { acceptLanguage });
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (BLOCKED_RESOURCE_TYPES.has(type)) {
      return route.abort();
    }
    return route.continue();
  });

  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const metrics: ScraperMetrics = {
    source: PipelineSource.ALIEXPRESS,
    itemsExtracted: 0,
    durationMs: 0,
    retries: 0,
    state: 'running',
    startedAt: new Date(start).toISOString(),
    finishedAt: '',
    errors: [],
  };

  try {
    for (const cat of CATEGORIES) {
      const catResult = await scrapeCategoryWithRetry(
        context,
        region,
        cat,
        maxItems,
        maxRetries,
        retryBaseMs,
        scrollPauseMs,
        maxScrolls,
        errors,
        metrics,
      );
      results.push(...catResult);
    }
    metrics.itemsExtracted = results.length;
    metrics.state = errors.length === 0 ? 'success' : 'failed';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`scrapeAliExpress fatal: ${msg}`);
    errors.push(`fatal: ${msg}`);
    metrics.state = 'failed';
  } finally {
    await browser.close();
    metrics.durationMs = Date.now() - start;
    metrics.finishedAt = new Date().toISOString();
    metrics.errors = errors;
    logger.log(
      `metrics: items=${metrics.itemsExtracted} durationMs=${metrics.durationMs} ` +
        `retries=${metrics.retries} state=${metrics.state} errors=${errors.length}`,
    );
  }

  // Persist raw JSON dump — always, even on a zero-item run, so the
  // page snapshot is available for inspection (ALI-7).
  const outputPath = await writeRawJson(
    PipelineSource.ALIEXPRESS,
    rawDir,
    results,
  );

  return {
    source: PipelineSource.ALIEXPRESS,
    totalScraped: results.length,
    outputPath,
    durationMs: metrics.durationMs,
    errors,
    metrics,
  };
}

async function scrapeCategoryWithRetry(
  context: BrowserContext,
  region: string,
  cat: { path: string; label: string },
  maxItems: number,
  maxRetries: number,
  retryBaseMs: number,
  scrollPauseMs: number,
  maxScrolls: number,
  errors: string[],
  metrics: ScraperMetrics,
): Promise<Record<string, unknown>[]> {
  const logger = new Logger('scrapeAliExpress');
  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt <= maxRetries) {
    const page = await context.newPage();
    try {
      const url = `https://${region}${cat.path}`;
      const response = await navigateWithRegionCheck(page, region, url);
      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} on ${url}`);
      }
      assertNoCaptchaMarker(page.url(), await page.content());

      await lazyLoad(page, maxScrolls, scrollPauseMs);
      const items = await extractItems(page, maxItems);
      const enriched = items.map((item) => ({
        ...item,
        _categoria: cat.label,
        _fuente: 'aliexpress',
        _extraido_en: new Date().toISOString(),
      }));
      logger.log(
        `category=${cat.label} items=${enriched.length} attempt=${attempt}`,
      );
      return enriched;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        `category=${cat.label} attempt=${attempt} failed: ${lastError.message}`,
      );
      if (attempt === maxRetries) break;
      metrics.retries += 1;
      const backoff = Math.min(
        retryBaseMs * Math.pow(2, attempt),
        MAX_BACKOFF_MS,
      );
      await page.close().catch(() => undefined);
      await delay(backoff + Math.floor(Math.random() * 500));
    } finally {
      await page.close().catch(() => undefined);
    }
    attempt += 1;
  }
  errors.push(
    `${cat.label}: ${lastError?.message ?? 'unknown'} (attempts=${attempt + 1})`,
  );
  return [];
}

/**
 * Navigate to `url`; if AliExpress redirects to a different region/locale
 * host than the one configured, re-navigate explicitly to the configured
 * region (ALI-3).
 */
async function navigateWithRegionCheck(
  page: Page,
  region: string,
  url: string,
): Promise<Response | null> {
  const response = await page.goto(url, {
    timeout: NAV_TIMEOUT_MS,
    waitUntil: 'domcontentloaded',
  });
  const landedHost = safeHost(page.url());
  if (landedHost && landedHost !== region) {
    const logger = new Logger('scrapeAliExpress');
    logger.warn(
      `region redirect detected: ${landedHost} → re-navigating to ${region}`,
    );
    return page.goto(url, {
      timeout: NAV_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
  }
  return response;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Throws a retryable error if the page looks like an anti-bot challenge. */
function assertNoCaptchaMarker(url: string, content: string): void {
  const haystack = `${url}\n${content}`.toLowerCase();
  const hit = CAPTCHA_MARKERS.find((marker) =>
    haystack.includes(marker.toLowerCase()),
  );
  if (hit) {
    throw new Error(`anti-bot challenge detected (marker="${hit}")`);
  }
}

/**
 * Scroll incrementally until either no new cards appear across two
 * consecutive scrolls, or `maxScrolls` is reached (ALI-4). Never
 * blocks forever.
 */
async function lazyLoad(
  page: Page,
  maxScrolls: number,
  scrollPauseMs: number,
): Promise<void> {
  let previousCount = await countCards(page);
  let stableRounds = 0;
  for (let i = 0; i < maxScrolls && stableRounds < 2; i++) {
    await page.evaluate(
      (px: number) => window.scrollBy(0, px),
      SCROLL_INCREMENT_PX,
    );
    await page.waitForTimeout(scrollPauseMs);
    const currentCount = await countCards(page);
    stableRounds = currentCount > previousCount ? 0 : stableRounds + 1;
    previousCount = currentCount;
  }
}

async function countCards(page: Page): Promise<number> {
  return page.evaluate((selectors: string[]) => {
    for (const sel of selectors) {
      const count = document.querySelectorAll(sel).length;
      if (count > 0) return count;
    }
    return 0;
  }, ITEM_SELECTORS);
}

async function extractItems(
  page: Page,
  maxItems: number,
): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    ({ selectors, cap }: { selectors: string[]; cap: number }) => {
      for (const sel of selectors) {
        const cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) {
          return cards.slice(0, cap).map((card) => {
            const el = card as HTMLElement;
            const anchor = el.querySelector('a');
            const titleEl = el.querySelector('[class*="title"]');
            const priceEl = el.querySelector('[class*="price"]');
            return {
              titulo: titleEl?.textContent?.trim() ?? null,
              precio: priceEl?.textContent?.trim() ?? null,
              moneda: 'USD',
              url_producto: anchor?.href ?? null,
            };
          });
        }
      }
      return [];
    },
    { selectors: ITEM_SELECTORS, cap: maxItems },
  );
}

function resolveRawDir(
  config: SourceConfig,
  configService: ConfigService,
): string {
  // NestJS runs with cwd already at `backend/`, so a repo-root-relative
  // fallback would double-nest into `backend/backend/...` — keep the
  // fallback relative to the app's own cwd instead.
  const envDir =
    configService.get<string>('PIPELINE_RAW_DIR') ?? 'pipeline/raw';
  if (!config.outputDir) {
    return `${envDir}/scraping/aliexpress`;
  }
  if (
    config.outputDir.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(config.outputDir)
  ) {
    return config.outputDir;
  }
  return `${envDir}/${config.outputDir}`;
}

async function writeRawJson(
  source: string,
  rawDir: string,
  data: unknown[],
): Promise<string> {
  await fs.mkdir(rawDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(rawDir, `${source}_${ts}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  return file;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  const configService = new ConfigService();
  const browserFactory = new BrowserFactoryService(configService);
  scrapeAliExpress(
    { source: PipelineSource.ALIEXPRESS, outputDir: 'cli/aliexpress' },
    browserFactory,
    configService,
  )
    .then((result) => {
      console.log(
        `aliexpress: items=${result.totalScraped} outputPath=${result.outputPath}`,
      );
      process.exit(result.totalScraped > 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error('aliexpress: fatal', err);
      process.exit(1);
    });
}
