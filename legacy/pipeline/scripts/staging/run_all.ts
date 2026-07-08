/**
 * Staging orchestrator (raw → staging).
 *
 * Dual-use: pure module (`runStaging(opts)`) + CLI self-execution.
 *
 * Reads the latest raw dumps from each source under
 * `pipeline/raw/{scraping,archivos,fuente_propia,api}/`,
 * normalises the schemas into one canonical product/encuesta shape
 * (homologación inter-fuentes), deduplicates, classifies (categoria +
 * currency conversion), and emits:
 *   - `pipeline/staging/all_products.json`
 *   - `pipeline/staging/stg_encuesta.json`
 *
 * The downstream quality_checks step generates the `*_clean.json`
 * variants; the DW loader reads those, not these.
 */
import * as fs from 'fs';
import * as path from 'path';
import { normalizeColumns } from './stg_normalize_columns';
import { standardizeDates } from './stg_dates';
import { loadRates, cleanAndConvertToUsd } from './stg_currency';
import { deduplicate } from './stg_dedup';
import { classifyCategory } from './stg_classify';
import type { StagingOptions, StagingResult } from '@web-scraping/contracts/pipeline';
import { logError } from '../scraping/_base';

const RAW_SCRAPING_DIR_BASENAME = 'raw/scraping';
const RAW_ARCHIVOS_DIR_BASENAME = 'raw/archivos';
const RAW_ENCUESTA_DIR_BASENAME = 'raw/fuente_propia';
const STAGING_DIR_BASENAME = 'staging';
const DATE_COLS = ['_extraido_en', 'fecha_publicacion', 'Timestamp'];

/**
 * Resolve pipeline root-relative paths the same way `saveToRaw` does in
 * the scrapers: try cwd first, fall back to the script's parent
 * ancestors. Returns absolute paths to the directories the caller needs.
 */
function resolvePipelineDirs(opts: StagingOptions): {
  rawScraping: string;
  rawArchivos: string;
  rawEncuesta: string;
  staging: string;
} {
  const cwd = process.cwd();
  const candidates: Array<{ root: string }> = [
    { root: cwd },
    { root: path.resolve(__dirname, '../../') },
    { root: path.resolve(__dirname, '../../../') },
  ];
  for (const { root } of candidates) {
    const stagingDir = opts.outputDir
      ? path.isAbsolute(opts.outputDir)
        ? opts.outputDir
        : path.join(root, opts.outputDir)
      : path.join(root, STAGING_DIR_BASENAME);
    if (fs.existsSync(stagingDir)) {
      const inputDir = opts.inputDir
        ? path.isAbsolute(opts.inputDir)
          ? opts.inputDir
          : path.join(root, opts.inputDir)
        : path.join(root, 'raw');
      return {
        rawScraping: path.join(inputDir, 'scraping'),
        rawArchivos: path.join(inputDir, 'archivos'),
        rawEncuesta: path.join(inputDir, 'fuente_propia'),
        staging: stagingDir,
      };
    }
  }
  // Last resort: cwd-rooted paths so a fresh init still works
  return {
    rawScraping: path.join(cwd, RAW_SCRAPING_DIR_BASENAME),
    rawArchivos: path.join(cwd, RAW_ARCHIVOS_DIR_BASENAME),
    rawEncuesta: path.join(cwd, RAW_ENCUESTA_DIR_BASENAME),
    staging: opts.outputDir
      ? path.isAbsolute(opts.outputDir)
        ? opts.outputDir
        : path.join(cwd, opts.outputDir)
      : path.join(cwd, STAGING_DIR_BASENAME),
  };
}

function loadLatestRaw(dirPath: string, prefix: string): unknown[] {
  if (!fs.existsSync(dirPath)) return [];

  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json') && f.startsWith(prefix) && !f.includes('extension_export'))
    .sort()
    .reverse();

  if (!files.length) return [];

  const filePath = path.join(dirPath, files[0]);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`  Cargado ${prefix}: ${(data as unknown[]).length} registros (${files[0]})`);
  return data as unknown[];
}

export async function runStaging(opts: StagingOptions = {}): Promise<StagingResult> {
  const start = Date.now();
  const { rawScraping, rawArchivos, rawEncuesta, staging } = resolvePipelineDirs(opts);
  fs.mkdirSync(staging, { recursive: true });
  const rates = loadRates();

  // 1. Procesar Fuentes de Productos (Scraping + Archivo Estructurado)
  const productSources = [
    { name: 'mercadolibre', dir: path.join(rawScraping, 'mercadolibre'), prefix: 'mercadolibre' },
    { name: 'aliexpress', dir: path.join(rawScraping, 'aliexpress'), prefix: 'aliexpress' },
    { name: 'temu', dir: path.join(rawScraping, 'temu'), prefix: 'temu' },
    { name: 'shein', dir: path.join(rawScraping, 'shein'), prefix: 'shein' },
    { name: 'archivos', dir: rawArchivos, prefix: 'dataset' },
  ];

  console.log('\n══ Iniciando Staging de Productos ══');
  const allRecords: Record<string, unknown>[] = [];

  for (const src of productSources) {
    console.log(`\nProcesando fuente de productos: ${src.name}`);
    const raw = loadLatestRaw(src.dir, src.prefix);
    if (!raw.length) {
      console.warn(`  ⚠ Sin datos para la fuente ${src.name}`);
      continue;
    }

    const processed = raw
      .map((record: unknown) => {
        try {
          let r = normalizeColumns(record as Record<string, unknown>);

          if (!r['_fuente']) r['_fuente'] = src.name;

          r = standardizeDates(r, DATE_COLS);

          const moneda = (r['moneda'] as string | undefined) ?? 'USD';
          r['precio_usd'] = cleanAndConvertToUsd(r['precio_raw'] as string | number | null, moneda, rates);

          for (const key of Object.keys(r)) {
            if (typeof r[key] === 'string') {
              r[key] = (r[key] as string).trim().normalize('NFC');
            }
          }

          r['categoria_normalizada'] = classifyCategory((r['titulo_oferta'] as string | null) ?? null);

          return r;
        } catch (err) {
          logError(src.name, 'TransformError', (err as Error).message, 'Registro omitido');
          return null;
        }
      })
      .filter((r): r is Record<string, unknown> => r !== null);

    allRecords.push(...processed);
  }

  console.log(`\nTotal productos antes de deduplicar: ${allRecords.length}`);

  const { data: dedupedProducts, removed: prodRemoved } = deduplicate(allRecords, [
    'titulo_oferta',
    'precio_raw',
    '_fuente',
  ]);
  console.log(`Duplicados eliminados: ${prodRemoved}`);
  console.log(`Total productos staging: ${dedupedProducts.length}`);

  const outFile = path.join(staging, 'all_products.json');
  fs.writeFileSync(outFile, JSON.stringify(dedupedProducts, null, 2), 'utf-8');
  console.log(`✓ Staging Productos guardado: ${outFile}`);

  // 2. Procesar Fuente Propia (Encuesta)
  let encuestaCount = 0;
  console.log('\n══ Iniciando Staging de Encuesta (Fuente Propia) ══');
  const rawEncuestas = loadLatestRaw(rawEncuesta, 'encuesta');
  if (rawEncuestas.length) {
    const processedEncuestas = rawEncuestas
      .map((record: unknown) => {
        try {
          const r: Record<string, unknown> = { ...(record as Record<string, unknown>) };
          for (const key of Object.keys(r)) {
            if (typeof r[key] === 'string') {
              r[key] = (r[key] as string).trim().normalize('NFC');
            }
          }
          r['_fuente'] = 'fuente_propia';
          return r;
        } catch (err) {
          logError('fuente_propia', 'TransformError', (err as Error).message, 'Registro de encuesta omitido');
          return null;
        }
      })
      .filter((r): r is Record<string, unknown> => r !== null);

    const { data: dedupedEncuestas, removed: encRemoved } = deduplicate(processedEncuestas, [
      'edad',
      'genero',
      'frecuencia_compra',
      'sitio_preferido',
      'gasto_promedio_mensual',
    ]);
    console.log(`Duplicados de encuesta eliminados: ${encRemoved}`);
    console.log(`Total encuestas staging: ${dedupedEncuestas.length}`);

    const outEncuestaFile = path.join(staging, 'stg_encuesta.json');
    fs.writeFileSync(outEncuestaFile, JSON.stringify(dedupedEncuestas, null, 2), 'utf-8');
    console.log(`✓ Staging Encuesta guardado: ${outEncuestaFile}`);
    encuestaCount = dedupedEncuestas.length;
  } else {
    console.warn('  ⚠ Sin datos de encuesta para procesar');
  }

  return {
    totalProductos: dedupedProducts.length,
    totalEncuestas: encuestaCount,
    durationMs: Date.now() - start,
  };
}

if (require.main === module) {
  runStaging().catch(err => {
    logError('staging', 'FatalError', (err as Error).message, 'Pipeline detenido');
    process.exit(1);
  });
}
