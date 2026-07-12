/**
 * Standalone MercadoLibre scraper for the scraper-worker.
 *
 * Extracted from the NestJS module to run inside the Playwright Docker container
 * with Xvfb headed mode. Replaces BrowserFactoryService with direct Playwright
 * launch using stealth plugin + headed mode.
 */
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_ACCEPT_LANGUAGE = 'es-EC,es;q=0.9';
const NAV_TIMEOUT_MS = 30000;
const SCROLL_PAUSE_MS = 1500;
const SETTLE_PAUSE_MS = 5000;
const MAX_ITEMS_PER_CATEGORY = 50;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 2000;
const MAX_BACKOFF_MS = 30000;

const CATEGORIES = [
  { url: 'https://www.mercadolibre.com.ec/', label: 'home' },
  {
    url: 'https://listado.mercadolibre.com.ec/electronica',
    label: 'electronica',
  },
];

const ITEM_SELECTORS = [
  'ol.ui-search-layout li.ui-search-layout__item',
  '.poly-card.poly-card--list',
  '.poly-card',
  '[class*="ui-search-result"]',
];

// ─── Stealth registration (once per process) ────────────────────────────────

let stealthRegistered = false;
function registerStealth() {
  if (stealthRegistered) return;
  chromium.use(stealth());
  stealthRegistered = true;
}

// ─── Launch browser (headed via Xvfb DISPLAY) ───────────────────────────────

async function launchBrowser() {
  registerStealth();
  return chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
}

// ─── Scraper logic ──────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractItems(page, maxItems) {
  return page.evaluate(
    ({ selectors, cap }) => {
      for (const sel of selectors) {
        const cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) {
          return cards.slice(0, cap).map((card) => {
            const el = card;
            const titleEl = el.querySelector(
              '.poly-component__title, .ui-search-item__title, h2 a, [class*="poly-title"]'
            );
            const priceEl = el.querySelector(
              '.andes-money-amount__fraction, .poly-price__current .andes-money-amount__fraction'
            );
            const urlEl = el.querySelector(
              '.poly-component__title a, a.ui-search-item__group__element'
            );
            return {
              titulo: titleEl?.textContent?.trim() ?? null,
              precio: priceEl?.textContent?.trim() ?? null,
              moneda: 'USD',
              url_producto: urlEl?.href ?? null,
            };
          });
        }
      }
      return [];
    },
    { selectors: ITEM_SELECTORS, cap: maxItems }
  );
}

async function scrapeCategoryWithRetry(
  context,
  cat,
  maxItems,
  maxRetries,
  retryBaseMs,
  settlePauseMs,
  scrollPauseMs,
  errors
) {
  let attempt = 0;
  let retries = 0;
  let lastError = null;
  while (attempt <= maxRetries) {
    const page = await context.newPage();
    try {
      const response = await page.goto(cat.url, {
        timeout: NAV_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} on ${cat.url}`);
      }
      // Settle + human-like interaction
      await page.waitForTimeout(settlePauseMs);
      await page.mouse.move(200, 300);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(scrollPauseMs);
      // Check for verification/block pages
      // NOTE: only actual blocking signals (account-verification, captcha)
      // indicate a blocked page. The `ui-search` class is absent on the ML
      // home page (a valid page), so checking for it causes false positives.
      const pageContent = await page.content();
      if (
        pageContent.includes('account-verification') ||
        pageContent.includes('captcha')
      ) {
        throw new Error('Blocked by anti-bot: redirected to verification page');
      }
      const items = await extractItems(page, maxItems);
      const enriched = items.map((item) => ({
        ...item,
        _categoria: cat.label,
        _fuente: 'mercadolibre',
        _extraido_en: new Date().toISOString(),
      }));
      console.log(
        `category=${cat.label} items=${enriched.length} attempt=${attempt}`
      );
      return { items: enriched, retries };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `category=${cat.label} attempt=${attempt} failed: ${lastError.message}`
      );
      if (attempt === maxRetries) break;
      retries++;
      const backoff = Math.min(
        retryBaseMs * Math.pow(2, attempt),
        MAX_BACKOFF_MS
      );
      await page.close().catch(() => undefined);
      await delay(backoff + Math.floor(Math.random() * 500));
    } finally {
      await page.close().catch(() => undefined);
    }
    attempt += 1;
  }
  errors.push(`${cat.url}: ${lastError?.message ?? 'unknown'}`);
  return { items: [], retries };
}

async function writeRawJson(source, rawDir, data) {
  await fs.mkdir(rawDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(rawDir, `${source}_${ts}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  return file;
}

// ─── Main scrape function ───────────────────────────────────────────────────

export async function scrapeMercadoLibre({ outputDir, maxItems } = {}) {
  const start = Date.now();
  const maxRetries = DEFAULT_MAX_RETRIES;
  const retryBaseMs = DEFAULT_RETRY_BASE_MS;
  const settlePauseMs = SETTLE_PAUSE_MS;
  const scrollPauseMs = SCROLL_PAUSE_MS;
  const catMaxItems = maxItems ?? MAX_ITEMS_PER_CATEGORY;

  const results = [];
  const errors = [];

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      locale: 'es-EC',
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      timezoneId: 'America/Guayaquil',
      geolocation: { latitude: -0.180653, longitude: -78.467837 },
      permissions: ['geolocation'],
      extraHTTPHeaders: { 'Accept-Language': DEFAULT_ACCEPT_LANGUAGE },
    });

    for (const cat of CATEGORIES) {
      const { items: catResult, retries: catRetries } =
        await scrapeCategoryWithRetry(
          context,
          cat,
          catMaxItems,
          maxRetries,
          retryBaseMs,
          settlePauseMs,
          scrollPauseMs,
          errors
        );
      results.push(...catResult);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`scrapeMercadoLibre fatal: ${msg}`);
    errors.push(`fatal: ${msg}`);
  } finally {
    await browser.close().catch(() => undefined);
  }

  const durationMs = Date.now() - start;

  // Determine output path
  const baseDir = outputDir || process.env.PIPELINE_RAW_DIR || '/tmp/scraper-output';
  const rawDir = `${baseDir}/mercadolibre`;
  const outputPath = await writeRawJson('mercadolibre', rawDir, results);

  const state = errors.length === 0 ? 'success' : 'failed';
  console.log(
    `metrics: items=${results.length} durationMs=${durationMs} state=${state} errors=${errors.length}`
  );

  return {
    source: 'mercadolibre',
    totalScraped: results.length,
    outputPath,
    durationMs,
    errors,
    metrics: {
      source: 'mercadolibre',
      itemsExtracted: results.length,
      durationMs,
      retries: 0,
      state,
      startedAt: new Date(start).toISOString(),
      finishedAt: new Date().toISOString(),
      errors,
    },
  };
}
