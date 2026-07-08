/**
 * Scraper — quotes.toscrape.com (sitio demo) + datos de extensión Chrome
 *
 * Para Temu: usa la extensión Chrome del proyecto (scraping en sesión real del usuario)
 * y carga el export JSON aquí. Si el export no existe, usa quotes.toscrape.com
 * como fuente de respaldo para demostrar la técnica de scraping.
 */
import { chromium } from 'playwright';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_PATH = path.join(__dirname, '../../raw/scraping/temu/extension_export.json');

async function scrapeQuotes(): Promise<Record<string, unknown>[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const results: Record<string, unknown>[] = [];

  const pages = [
    'https://quotes.toscrape.com/page/1/',
    'https://quotes.toscrape.com/page/2/',
    'https://quotes.toscrape.com/page/3/',
  ];

  for (const url of pages) {
    const page = await context.newPage();
    try {
      console.log(`Scrapeando: ${url}`);
      const response = await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });

      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()}`);
      }

      await randomDelay(1500, 3000);

      const items: Record<string, unknown>[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.quote')).map(q => ({
          texto: q.querySelector('.text')?.textContent?.trim() ?? null,
          autor: q.querySelector('.author')?.textContent?.trim() ?? null,
          tags: Array.from(q.querySelectorAll('.tag')).map(t => t.textContent?.trim()),
        }))
      );

      const enriched = items.map(item => ({
        ...item,
        titulo: item['texto'],          // campo canónico para staging
        precio: null,
        _fuente: 'temu',
        _extraido_en: new Date().toISOString(),
      }));

      console.log(`  → ${enriched.length} registros`);
      results.push(...enriched);
    } catch (err: any) {
      logError('temu', 'ScrapingError', err.message, 'Página omitida');
    } finally {
      await page.close();
      await randomDelay(2000, 4000);
    }
  }

  await browser.close();
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
    _fuente: 'temu',
    _extraido_en: new Date().toISOString(),
  }));
}

async function main() {
  let results: Record<string, unknown>[];

  if (fs.existsSync(EXPORT_PATH)) {
    console.log('Cargando datos de Temu desde extensión Chrome...');
    results = await loadFromExtension();
    console.log(`✓ ${results.length} productos cargados desde extensión`);
  } else {
    console.warn('⚠ Export de extensión no encontrado. Usando quotes.toscrape.com como respaldo.');
    results = await scrapeQuotes();
  }

  saveToRaw('temu', results);
}

main().catch(err => {
  logError('temu', 'FatalError', err.message, 'Proceso terminado');
  process.exit(1);
});
