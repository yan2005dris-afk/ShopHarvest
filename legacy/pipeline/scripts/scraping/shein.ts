/**
 * Scraper — Shein (vía extensión Chrome) con fallback a
 * quotes.toscrape.com/login (escena de autenticación).
 *
 * Dual-use: pure module (`scrapeShein(config)`) + CLI self-execution.
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';

const EXPORT_PATH = path.join(process.cwd(), 'pipeline/raw/scraping/shein/extension_export.json');

async function scrapeWithSession(): Promise<Record<string, unknown>[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const results: Record<string, unknown>[] = [];

  try {
    console.log('Autenticando en quotes.toscrape.com/login...');
    await page.goto('https://quotes.toscrape.com/login', { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await randomDelay(1000, 2000);
    await page.click('input[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    const loginOk = page.url().includes('/login') === false;
    console.log(`  Login: ${loginOk ? 'exitoso' : 'fallido'}`);

    for (let p = 1; p <= 3; p++) {
      await page.goto(`https://quotes.toscrape.com/page/${p}/`, { timeout: 20000 });
      await randomDelay(1500, 3000);

      const items: Record<string, unknown>[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.quote')).map(q => ({
          titulo: q.querySelector('.text')?.textContent?.trim() ?? null,
          autor: q.querySelector('.author')?.textContent?.trim() ?? null,
          tags: Array.from(q.querySelectorAll('.tag')).map(t => t.textContent?.trim()),
          precio: null,
        })),
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
  } catch (err) {
    logError('shein', 'ScrapingError', (err as Error).message, 'Sesión omitida');
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

export async function scrapeShein(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const errors: string[] = [];
  let results: Record<string, unknown>[];

  if (fs.existsSync(EXPORT_PATH)) {
    console.log('Cargando datos de Shein desde extensión Chrome...');
    results = await loadFromExtension();
    console.log(`✓ ${results.length} productos cargados desde extensión`);
  } else {
    console.warn('⚠ Export de extensión no encontrado. Usando quotes.toscrape.com como respaldo.');
    results = await scrapeWithSession();
  }

  const maxItems = config.maxItems ?? Infinity;
  const trimmed = results.slice(0, maxItems);
  const outputPath = saveToRaw('shein', trimmed);

  return {
    source: PipelineSource.SHEIN,
    totalScraped: trimmed.length,
    outputPath: path.isAbsolute(outputPath) ? outputPath : path.resolve(outputPath),
    durationMs: Date.now() - start,
    errors,
  };
}

if (require.main === module) {
  scrapeShein({
    source: PipelineSource.SHEIN,
    outputDir: 'pipeline/raw/scraping/shein',
  }).catch(err => {
    logError('shein', 'FatalError', (err as Error).message, 'Proceso terminado');
    process.exit(1);
  });
}
