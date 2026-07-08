/**
 * Scraper — books.toscrape.com (sitio demo académico que representa
 * la fuente AliExpress en este pipeline — la operación real contra
 * AliExpress.DataDome requeriría proxies residenciales y queda fuera
 * del alcance académico del E3).
 *
 * Dual-use: callable as a pure module (`scrapeBooks(config)`) or
 * self-executing via `npx ts-node scripts/scraping/aliexpress.ts`.
 */
import * as path from 'path';
import { chromium } from 'playwright';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';

const PAGES = [
  'https://books.toscrape.com/catalogue/category/books/mystery_3/index.html',
  'https://books.toscrape.com/catalogue/category/books/science-fiction_16/index.html',
  'https://books.toscrape.com/catalogue/category/books/nonfiction_13/index.html',
];

/**
 * Scrape books.toscrape.com into the configured raw dir.
 *
 * Used as a stand-in for AliExpress per the academic-method note above.
 */
export async function scrapeBooks(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const outputDir = config.outputDir
    ? path.isAbsolute(config.outputDir)
      ? config.outputDir
      : path.join(process.cwd(), config.outputDir)
    : path.join(process.cwd(), 'pipeline/raw/scraping/aliexpress');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (const url of PAGES) {
    const page = await context.newPage();
    try {
      console.log(`Scrapeando: ${url}`);
      const response = await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()}`);
      }

      await randomDelay(2000, 4000);

      const categoria = url.match(/books\/([^/]+)\//)?.[1]?.replace(/_\d+$/, '') ?? 'general';

      const items: Record<string, unknown>[] = await page.evaluate((cat: string) => {
        return Array.from(document.querySelectorAll('article.product_pod')).map(card => ({
          titulo: (card.querySelector('h3 a') as HTMLAnchorElement | null)?.getAttribute('title') ?? null,
          precio: card.querySelector('.price_color')?.textContent?.trim() ?? null,
          moneda: 'GBP',
          rating: card.querySelector('p.star-rating')?.className?.replace('star-rating ', '') ?? null,
          disponibilidad: card.querySelector('.availability')?.textContent?.trim() ?? null,
          categoria: cat,
        }));
      }, categoria);

      const enriched = items.map(item => ({
        ...item,
        _fuente: 'aliexpress',
        _extraido_en: new Date().toISOString(),
      }));

      console.log(`  → ${enriched.length} productos`);
      results.push(...enriched);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      logError('aliexpress', 'ScrapingError', message, 'Página omitida');
      errors.push(message);
    } finally {
      await page.close();
      await randomDelay(2000, 4000);
    }
  }

  await browser.close();

  const maxItems = config.maxItems ?? Infinity;
  const trimmed = results.slice(0, maxItems);
  const outputPath = saveToRaw('aliexpress', trimmed);
  return {
    source: PipelineSource.ALIEXPRESS,
    totalScraped: trimmed.length,
    outputPath: path.isAbsolute(outputPath) ? outputPath : path.resolve(outputPath),
    durationMs: Date.now() - start,
    errors,
  };
}

if (require.main === module) {
  scrapeBooks({
    source: PipelineSource.ALIEXPRESS,
    outputDir: 'pipeline/raw/scraping/aliexpress',
  }).catch(err => {
    logError('aliexpress', 'FatalError', (err as Error).message, 'Proceso terminado');
    process.exit(1);
  });
}
