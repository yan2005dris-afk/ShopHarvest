/**
 * Scraper — MercadoLibre Ecuador (native NestJS, no bridge).
 *
 * Replaces the legacy `scripts/scraping/mercadolibre.ts` (deleted in
 * PR 1b). Targets the real `mercadolibre.com.ec` production site
 * (not a demo). Uses BrowserFactoryService for stealth + optional
 * proxy, retries with exponential backoff on transient failures, and
 * writes raw JSON to the configured PIPELINE_RAW_DIR.
 *
 * Wire contract: returns `ScrapeResult` (per IDataSource), with the
 * `ScraperMetrics` payload attached at `result.metrics`. PR 6's
 * persistence layer reads `result.metrics` to populate `EtlRun`.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Page, Response } from 'playwright';
import type {
  ScrapeResult,
  SourceConfig,
  ScraperMetrics,
} from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { BrowserFactoryService } from './browser-factory.service';

const DEFAULT_ACCEPT_LANGUAGE = 'es-EC,es;q=0.9';
const DEFAULT_MAX_RETRIES = 2; // 3 total attempts
const DEFAULT_RETRY_BASE_MS = 2000;
const MAX_BACKOFF_MS = 30000;
const NAV_TIMEOUT_MS = 30000;
const SCROLL_PAUSE_MS = 1500;
const SETTLE_PAUSE_MS = 3000;
const MAX_ITEMS_PER_CATEGORY = 50;

const CATEGORIES: ReadonlyArray<{ url: string; label: string }> = [
  { url: 'https://www.mercadolibre.com.ec/', label: 'home' },
  {
    url: 'https://listado.mercadolibre.com.ec/electronica',
    label: 'electronica',
  },
];

const ITEM_SELECTORS = [
  '.ui-search-result__content',
  '.poly-card',
  '[data-id]',
  '.item__info',
];

export interface ScrapeMercadoLibreOptions {
  /** Maximum number of retry attempts per category after the first try. */
  maxRetries?: number;
  /** Base backoff in ms; doubled per attempt, capped at 30s. */
  retryBaseMs?: number;
  /** Settle pause in ms after navigation (default 3000). Lower for tests. */
  settlePauseMs?: number;
  /** Scroll pause in ms after scrollBy (default 1500). Lower for tests. */
  scrollPauseMs?: number;
}

/**
 * Scrape MercadoLibre Ecuador.
 *
 * - `config.outputDir` is honored if absolute; if relative, it's joined
 *   with the resolved `PIPELINE_RAW_DIR` env var (NOT process.cwd()).
 * - `config.maxItems` hard-caps the resulting items array.
 * - `config.extra.acceptLanguage` (optional) overrides the default
 *   `es-EC,es;q=0.9` Accept-Language header.
 * - `opts.maxRetries` / `opts.retryBaseMs` override the default retry policy.
 *
 * Returns a `ScrapeResult` with the total items, output path, duration,
 * and a list of non-fatal errors. Retries on HTTP 4xx/5xx and
 * Playwright-level navigation errors up to N times with exponential
 * backoff. After retries are exhausted, the error is recorded in
 * `errors[]` and the run continues with the next category.
 */
export async function scrapeMercadoLibre(
  config: SourceConfig,
  browserFactory: BrowserFactoryService,
  configService: ConfigService,
  opts: ScrapeMercadoLibreOptions = {},
): Promise<ScrapeResult> {
  const logger = new Logger('scrapeMercadoLibre');
  const start = Date.now();
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseMs = opts.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  const settlePauseMs = opts.settlePauseMs ?? SETTLE_PAUSE_MS;
  const scrollPauseMs = opts.scrollPauseMs ?? SCROLL_PAUSE_MS;

  const acceptLanguage =
    typeof config.extra?.['acceptLanguage'] === 'string'
      ? config.extra['acceptLanguage']
      : DEFAULT_ACCEPT_LANGUAGE;

  const rawDir = resolveRawDir(config, configService);
  const maxItems = config.maxItems ?? MAX_ITEMS_PER_CATEGORY;

  const browser = await browserFactory.launch({ acceptLanguage });
  const context = await browserFactory.newContext(browser, { acceptLanguage });
  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const metrics: ScraperMetrics = {
    source: PipelineSource.MERCADOLIBRE,
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
        cat,
        maxItems,
        maxRetries,
        retryBaseMs,
        settlePauseMs,
        scrollPauseMs,
        errors,
      );
      results.push(...catResult);
    }
    metrics.itemsExtracted = results.length;
    metrics.state = errors.length === 0 ? 'success' : 'failed';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`scrapeMercadoLibre fatal: ${msg}`);
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

  // Persist raw JSON dump.
  const outputPath = await writeRawJson(
    PipelineSource.MERCADOLIBRE,
    rawDir,
    results,
  );

  return {
    source: PipelineSource.MERCADOLIBRE,
    totalScraped: results.length,
    outputPath,
    durationMs: metrics.durationMs,
    errors,
    metrics,
  };
}

async function scrapeCategoryWithRetry(
  context: import('playwright').BrowserContext,
  cat: { url: string; label: string },
  maxItems: number,
  maxRetries: number,
  retryBaseMs: number,
  settlePauseMs: number,
  scrollPauseMs: number,
  errors: string[],
): Promise<Record<string, unknown>[]> {
  const logger = new Logger('scrapeMercadoLibre');
  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt <= maxRetries) {
    const page = await context.newPage();
    try {
      const response: Response | null = await page.goto(cat.url, {
        timeout: NAV_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} on ${cat.url}`);
      }
      // Settle + human-like interaction: small mouse move + scroll.
      await page.waitForTimeout(settlePauseMs);
      await page.mouse.move(200, 300);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(scrollPauseMs);
      const items = await extractItems(page, maxItems);
      const enriched = items.map((item) => ({
        ...item,
        _categoria: cat.label,
        _fuente: 'mercadolibre',
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
  errors.push(`${cat.url}: ${lastError?.message ?? 'unknown'}`);
  return [];
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
            const priceEl = el.querySelector(
              '[class*="price"], .andes-money-amount__fraction',
            );
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
  // NestJS runs with cwd already at `backend/` (nest-cli.json / start
  // scripts), so a repo-root-relative fallback like 'backend/pipeline/raw'
  // silently doubles up into 'backend/backend/pipeline/raw'. Keep the
  // fallback relative to the app's own cwd instead.
  const envDir =
    configService.get<string>('PIPELINE_RAW_DIR') ?? 'pipeline/raw';
  if (!config.outputDir) {
    return `${envDir}/scraping/mercadolibre`;
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
