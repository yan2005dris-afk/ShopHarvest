/**
 * Scraper — Temu (vía extensión Chrome) con fallback a quotes.toscrape.com.
 *
 * Dual-use: pure module (`scrapeTemu(config)`) + CLI self-execution.
 *
 * Si el export JSON de la extensión Chrome existe en
 * `pipeline/raw/scraping/temu/extension_export.json`, se usa ese (vía
 * scraping real del usuario). Si no, se scrappea quotes.toscrape.com
 * como fuente de respaldo para demostrar la técnica (igual que en E3).
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { saveToRaw, logError, randomDelay, USER_AGENT } from './_base';

const EXPORT_PATH = path.join(process.cwd(), 'pipeline/raw/scraping/temu/extension_export.json');

const FALLBACK_PAGES = [
  'https://quotes.toscrape.com/page/1/',
  'https://quotes.toscrape.com/page/2/',
  'https://quotes.toscrape.com/page/3/',
];

async function scrapeQuotes(): Promise<Record<string, unknown>[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const results: Record<string, unknown>[] = [];

  for (const url of FALLBACK_PAGES) {
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
        })),
      );

      const enriched = items.map(item => ({
        ...item,
        titulo: item['texto'],
        precio: null,
        _fuente: 'temu',
        _extraido_en: new Date().toISOString(),
      }));

      console.log(`  → ${enriched.length} registros`);
      results.push(...enriched);
    } catch (err) {
      logError('temu', 'ScrapingError', (err as Error).message, 'Página omitida');
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

export async function scrapeTemu(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const errors: string[] = [];
  let results: Record<string, unknown>[];

  if (fs.existsSync(EXPORT_PATH)) {
    console.log('Cargando datos de Temu desde extensión Chrome...');
    results = await loadFromExtension();
    console.log(`✓ ${results.length} productos cargados desde extensión`);
  } else {
    console.warn('⚠ Export de extensión no encontrado. Usando quotes.toscrape.com como respaldo.');
    results = await scrapeQuotes();
  }

  const maxItems = config.maxItems ?? Infinity;
  const trimmed = results.slice(0, maxItems);
  const outputPath = saveToRaw('temu', trimmed);

  return {
    source: PipelineSource.TEMU,
    totalScraped: trimmed.length,
    outputPath: path.isAbsolute(outputPath) ? outputPath : path.resolve(outputPath),
    durationMs: Date.now() - start,
    errors,
  };
}

if (require.main === module) {
  scrapeTemu({
    source: PipelineSource.TEMU,
    outputDir: 'pipeline/raw/scraping/temu',
  }).catch(err => {
    logError('temu', 'FatalError', (err as Error).message, 'Proceso terminado');
    process.exit(1);
  });
}
