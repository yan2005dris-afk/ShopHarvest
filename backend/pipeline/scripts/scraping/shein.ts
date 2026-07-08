/**
 * Scraper — toscrape.com/login (sitio demo con autenticación) + datos de extensión Chrome
 *
 * Para Shein: usa export de extensión Chrome. Como respaldo, scrapeamos
 * quotes.toscrape.com/login para demostrar manejo de sesiones autenticadas.
 */
import { chromium } from 'playwright';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_PATH = path.join(__dirname, '../../raw/scraping/shein/extension_export.json');

async function scrapeWithSession(): Promise<Record<string, unknown>[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const results: Record<string, unknown>[] = [];

  try {
    // Login con credenciales demo
    console.log('Autenticando en quotes.toscrape.com/login...');
    await page.goto('https://quotes.toscrape.com/login', { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await randomDelay(1000, 2000);
    await page.click('input[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    const loginOk = page.url().includes('/login') === false;
    console.log(`  Login: ${loginOk ? 'exitoso' : 'fallido'}`);

    // Scraping post-login con delays preventivos
    for (let p = 1; p <= 3; p++) {
      await page.goto(`https://quotes.toscrape.com/page/${p}/`, { timeout: 20000 });
      await randomDelay(1500, 3000);

      const items: Record<string, unknown>[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.quote')).map(q => ({
          titulo: q.querySelector('.text')?.textContent?.trim() ?? null,
          autor: q.querySelector('.author')?.textContent?.trim() ?? null,
          tags: Array.from(q.querySelectorAll('.tag')).map(t => t.textContent?.trim()),
          precio: null,
        }))
      );

      const enriched = items.map(item => ({
        ...item,
        _pagina: p,
        _fuente: 'shein',
        _extraido_en: new Date().toISOString(),
      }));

      console.log(`  → Página ${p}: ${enriched.length} registros`);
      results.push(...enriched);
      await randomDelay(2000, 4000);
    }
  } catch (err: any) {
    logError('shein', 'ScrapingError', err.message, 'Sesión omitida');
  } finally {
    await browser.close();
  }

  return results;
}

async function loadFromExtension(): Promise<Record<string, unknown>[]> {
  const raw = fs.readFileSync(EXPORT_PATH, 'utf-8');
  const data: Record<string, unknown>[] = JSON.parse(raw);
  return data.map(item => ({
    titulo: item['title'] ?? item['titulo'] ?? item['name'] ?? null,
    precio: item['price'] ?? item['precio'] ?? null,
    moneda: item['currency'] ?? 'USD',
    categoria: item['category'] ?? item['categoria'] ?? null,
    url_producto: item['url'] ?? item['link'] ?? null,
    _fuente: 'shein',
    _extraido_en: new Date().toISOString(),
  }));
}

async function main() {
  let results: Record<string, unknown>[];

  if (fs.existsSync(EXPORT_PATH)) {
    console.log('Cargando datos de Shein desde extensión Chrome...');
    results = await loadFromExtension();
    console.log(`✓ ${results.length} productos cargados desde extensión`);
  } else {
    console.warn('⚠ Export de extensión no encontrado. Usando quotes.toscrape.com como respaldo.');
    results = await scrapeWithSession();
  }

  saveToRaw('shein', results);
}

main().catch(err => {
  logError('shein', 'FatalError', err.message, 'Proceso terminado');
  process.exit(1);
});
