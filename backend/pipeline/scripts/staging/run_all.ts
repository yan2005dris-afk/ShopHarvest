import * as fs from 'fs';
import * as path from 'path';
import { normalizeColumns } from './stg_normalize_columns';
import { standardizeDates } from './stg_dates';
import { loadRates, cleanAndConvertToUsd } from './stg_currency';
import { deduplicate } from './stg_dedup';
import { classifyCategory } from './stg_classify';
import { logError } from '../scraping/_base';

const RAW_SCRAPING_DIR = path.join(__dirname, '../../raw/scraping');
const RAW_ARCHIVOS_DIR = path.join(__dirname, '../../raw/archivos');
const RAW_ENCUESTA_DIR = path.join(__dirname, '../../raw/fuente_propia');
const STAGING_DIR = path.join(__dirname, '../../staging');
const DATE_COLS = ['_extraido_en', 'fecha_publicacion', 'Timestamp'];

function loadLatestRaw(dirPath: string, prefix: string): any[] {
  if (!fs.existsSync(dirPath)) return [];

  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json') && f.startsWith(prefix) && !f.includes('extension_export'))
    .sort()
    .reverse();

  if (!files.length) return [];

  const filePath = path.join(dirPath, files[0]);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`  Cargado ${prefix}: ${data.length} registros (${files[0]})`);
  return data;
}

async function runStaging() {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const rates = loadRates();

  // 1. Procesar Fuentes de Productos (Scraping + Archivo Estructurado)
  const productSources = [
    { name: 'mercadolibre', dir: path.join(RAW_SCRAPING_DIR, 'mercadolibre'), prefix: 'mercadolibre' },
    { name: 'aliexpress', dir: path.join(RAW_SCRAPING_DIR, 'aliexpress'), prefix: 'aliexpress' },
    { name: 'temu', dir: path.join(RAW_SCRAPING_DIR, 'temu'), prefix: 'temu' },
    { name: 'shein', dir: path.join(RAW_SCRAPING_DIR, 'shein'), prefix: 'shein' },
    { name: 'archivos', dir: RAW_ARCHIVOS_DIR, prefix: 'dataset' } // Dataset estructurado C
  ];

  console.log('\n══ Iniciando Staging de Productos ══');
  let allRecords: any[] = [];

  for (const src of productSources) {
    console.log(`\nProcesando fuente de productos: ${src.name}`);
    const raw = loadLatestRaw(src.dir, src.prefix);
    if (!raw.length) {
      console.warn(`  ⚠ Sin datos para la fuente ${src.name}`);
      continue;
    }

    const processed = raw.map((record: any) => {
      try {
        // Normalizar nombres de columnas (homologación inter-fuentes)
        let r = normalizeColumns(record);

        // Asegurar que tenga la fuente correcta seteada
        if (!r._fuente) r._fuente = src.name;

        // Estandarizar fechas a YYYY-MM-DD
        r = standardizeDates(r, DATE_COLS);

        // Limpiar precio y convertir a USD
        const moneda = r.moneda ?? 'USD';
        r.precio_usd = cleanAndConvertToUsd(r.precio_raw, moneda, rates);

        // Estandarizar strings a UTF-8 NFC
        for (const key of Object.keys(r)) {
          if (typeof r[key] === 'string') {
            r[key] = r[key].trim().normalize('NFC');
          }
        }

        // Clasificar categoría
        r.categoria_normalizada = classifyCategory(r.titulo_oferta ?? null);

        return r;
      } catch (err: any) {
        logError(src.name, 'TransformError', err.message, 'Registro omitido');
        return null;
      }
    }).filter(Boolean);

    allRecords.push(...processed);
  }

  console.log(`\nTotal productos antes de deduplicar: ${allRecords.length}`);

  // Deduplicar productos por clave compuesta
  const { data: dedupedProducts, removed: prodRemoved } = deduplicate(allRecords, ['titulo_oferta', 'precio_raw', '_fuente']);
  console.log(`Duplicados eliminados: ${prodRemoved}`);
  console.log(`Total productos staging: ${dedupedProducts.length}`);

  const outFile = path.join(STAGING_DIR, 'all_products.json');
  fs.writeFileSync(outFile, JSON.stringify(dedupedProducts, null, 2), 'utf-8');
  console.log(`✓ Staging Productos guardado: ${outFile}`);

  // 2. Procesar Fuente Propia (Encuesta - Tipología D)
  console.log('\n══ Iniciando Staging de Encuesta (Fuente Propia) ══');
  const rawEncuestas = loadLatestRaw(RAW_ENCUESTA_DIR, 'encuesta');
  if (rawEncuestas.length) {
    const processedEncuestas = rawEncuestas.map((record: any) => {
      try {
        const r = { ...record };
        // Normalizar strings a UTF-8 NFC
        for (const key of Object.keys(r)) {
          if (typeof r[key] === 'string') {
            r[key] = r[key].trim().normalize('NFC');
          }
        }
        // Marcar procedencia de encuesta
        r._fuente = 'fuente_propia';
        return r;
      } catch (err: any) {
        logError('fuente_propia', 'TransformError', err.message, 'Registro de encuesta omitido');
        return null;
      }
    }).filter(Boolean);

    // Deduplicar encuestas en base a coincidencia exacta de respuestas
    const { data: dedupedEncuestas, removed: encRemoved } = deduplicate(processedEncuestas, [
      'edad', 'genero', 'frecuencia_compra', 'sitio_preferido', 'gasto_promedio_mensual'
    ]);
    console.log(`Duplicados de encuesta eliminados: ${encRemoved}`);
    console.log(`Total encuestas staging: ${dedupedEncuestas.length}`);

    const outEncuestaFile = path.join(STAGING_DIR, 'stg_encuesta.json');
    fs.writeFileSync(outEncuestaFile, JSON.stringify(dedupedEncuestas, null, 2), 'utf-8');
    console.log(`✓ Staging Encuesta guardado: ${outEncuestaFile}`);
  } else {
    console.warn('  ⚠ Sin datos de encuesta para procesar');
  }
}

runStaging().catch(err => {
  logError('staging', 'FatalError', err.message, 'Pipeline detenido');
  process.exit(1);
});
