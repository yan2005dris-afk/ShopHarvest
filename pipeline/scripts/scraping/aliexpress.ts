/**
 * Scraper — books.toscrape.com (sitio demo de scraping académico)
 * Representa la fuente "AliExpress" en el pipeline para demostrar la técnica.
 * Sitio diseñado específicamente para practicar web scraping (sin bloqueos).
 *
 * NOTA METODOLÓGICA: AliExpress implementa protecciones anti-bot avanzadas
 * (DataDome) que requieren proxies residenciales para eludir. Para el alcance
 * académico de este entregable se usa books.toscrape.com como fuente equivalente
 * que permite demostrar todos los requerimientos técnicos del E3.
 */
import { chromium } from 'playwright';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';

const PAGES = [
  'https://books.toscrape.com/catalogue/category/books/mystery_3/index.html',
  'https://books.toscrape.com/catalogue/category/books/science-fiction_16/index.html',
  'https://books.toscrape.com/catalogue/category/books/nonfiction_13/index.html',
];

async function scrapeBooks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const results: Record<string, unknown>[] = [];

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
    } catch (err: any) {
      logError('aliexpress', 'ScrapingError', err.message, 'Página omitida');
    } finally {
      await page.close();
      await randomDelay(2000, 4000);
    }
  }

  await browser.close();
  saveToRaw('aliexpress', results);
}

scrapeBooks().catch(err => {
  logError('aliexpress', 'FatalError', err.message, 'Proceso terminado');
  process.exit(1);
});
