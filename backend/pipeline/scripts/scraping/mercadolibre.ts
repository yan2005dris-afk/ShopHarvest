/**
 * Scraper — MercadoLibre Ecuador
 * Usa Playwright headless con delays preventivos y manejo de errores HTTP.
 * MercadoLibre bloquea requests directos; Playwright simula un navegador real.
 */
import { chromium } from 'playwright';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';

const CATEGORIES = [
  { url: 'https://listado.mercadolibre.com.ec/_Tienda_temu', label: 'electronica' },
  { url: 'https://www.mercadolibre.com.ec/', label: 'home' },
];

async function scrapeMercadoLibre() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    extraHTTPHeaders: { 'Accept-Language': 'es-EC,es;q=0.9' },
  });
  const results: Record<string, unknown>[] = [];

  for (const cat of CATEGORIES) {
    const page = await context.newPage();
    try {
      console.log(`Scrapeando: ${cat.url}`);
      const response = await page.goto(cat.url, { timeout: 30000, waitUntil: 'domcontentloaded' });

      // Verificar código HTTP
      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} en ${cat.url}`);
      }

      await randomDelay(3000, 5000);
      await page.mouse.move(200, 300); // simular movimiento humano

      // Scroll para activar carga lazy
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
    } catch (err: any) {
      logError('mercadolibre', 'ScrapingError', `${cat.label}: ${err.message}`, 'Categoría omitida');
    } finally {
      await page.close();
      await randomDelay(3000, 6000);
    }
  }

  await browser.close();
  saveToRaw('mercadolibre', results);
}

scrapeMercadoLibre().catch(err => {
  logError('mercadolibre', 'FatalError', err.message, 'Proceso terminado');
  process.exit(1);
});
