/**
 * Scraper — MercadoLibre Ecuador.
 *
 * Dual-use: callable as a pure module (`scrapeMercadoLibre(config)`)
 * or self-executing from `npx ts-node scripts/scraping/mercadolibre.ts`.
 *
 * Why two entry-points? The NestJS pipeline module imports the
 * function through `scripts-bridge.ts`; the CLI keeps working for
 * operators who want to re-run a scraper without spinning up the
 * backend. Both paths share the same underlying logic so the CLI is
 * just the function called at the bottom of this file.
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';

const CATEGORIES = [
  { url: 'https://listado.mercadolibre.com.ec/_Tienda_temu', label: 'electronica' },
  { url: 'https://www.mercadolibre.com.ec/', label: 'home' },
];

/**
 * Scrape MercadoLibre Ecuador into the configured raw output dir.
 *
 * - `config.outputDir` is appended to `backend/pipeline/raw/scraping/mercadolibre/`
 *   if it is relative. If absolute, used as-is.
 * - `config.maxItems` (optional) hard-caps the resulting items array.
 * - `config.extra.acceptLanguage` (optional) overrides the default
 *   `es-EC,es;q=0.9` Accept-Language header.
 */
export async function scrapeMercadoLibre(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const acceptLanguage =
    (config.extra && typeof config.extra['acceptLanguage'] === 'string'
      ? (config.extra['acceptLanguage'] as string)
      : 'es-EC,es;q=0.9');
  const outputDir = config.outputDir
    ? path.isAbsolute(config.outputDir)
      ? config.outputDir
      : path.join(process.cwd(), config.outputDir)
    : path.join(process.cwd(), 'pipeline/raw/scraping/mercadolibre');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    extraHTTPHeaders: { 'Accept-Language': acceptLanguage },
  });
  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (const cat of CATEGORIES) {
    const page = await context.newPage();
    try {
      console.log(`Scrapeando: ${cat.url}`);
      const response = await page.goto(cat.url, { timeout: 30000, waitUntil: 'domcontentloaded' });

      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} en ${cat.url}`);
      }

      await randomDelay(3000, 5000);
      await page.mouse.move(200, 300);

      await page.evaluate(() => window.scrollBy(0, 600));
      await randomDelay(1500, 2500);

      const items: Record<string, unknown>[] = await page.evaluate(() => {
        const selectors = [
          '.ui-search-result__content',
          '.poly-card',
          '[data-id]',
          '.item__info',
        ];
        for (const sel of selectors) {
          const cards = Array.from(document.querySelectorAll(sel));
          if (cards.length > 0) {
            return cards.slice(0, 50).map(card => ({
              titulo: card.querySelector('[class*="title"]')?.textContent?.trim() ?? null,
              precio: card.querySelector('[class*="price"],.andes-money-amount__fraction')?.textContent?.trim() ?? null,
              moneda: 'USD',
              url_producto: (card.querySelector('a') as HTMLAnchorElement | null)?.href ?? null,
            }));
          }
        }
        return [];
      });

      const enriched = items.map(item => ({
        ...item,
        _categoria: cat.label,
        _fuente: 'mercadolibre',
        _extraido_en: new Date().toISOString(),
      }));

      console.log(`  → ${enriched.length} productos (${cat.label})`);
      results.push(...enriched);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      logError('mercadolibre', 'ScrapingError', `${cat.label}: ${message}`, 'Categoría omitida');
      errors.push(message);
    } finally {
      await page.close();
      await randomDelay(3000, 6000);
    }
  }

  await browser.close();

  const maxItems = config.maxItems ?? Infinity;
  const trimmed = results.slice(0, maxItems);
  const outputPath = saveToRaw('mercadolibre', trimmed);
  return {
    source: PipelineSource.MERCADOLIBRE,
    totalScraped: trimmed.length,
    outputPath: path.isAbsolute(outputPath) ? outputPath : path.resolve(outputPath),
    durationMs: Date.now() - start,
    errors,
  };
}

if (require.main === module) {
  scrapeMercadoLibre({
    source: PipelineSource.MERCADOLIBRE,
    outputDir: 'pipeline/raw/scraping/mercadolibre',
  }).catch(err => {
    logError('mercadolibre', 'FatalError', (err as Error).message, 'Proceso terminado');
    process.exit(1);
  });
}
