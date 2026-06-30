import * as fs from 'fs';
import * as path from 'path';
import { normalizeColumns } from './stg_normalize_columns';
import { standardizeDates } from './stg_dates';
import { loadRates, cleanAndConvertToUsd } from './stg_currency';
import { deduplicate } from './stg_dedup';
import { classifyCategory } from './stg_classify';
import { logError } from '../scraping/_base';

const RAW_DIR = path.join(__dirname, '../../raw/scraping');
const STAGING_DIR = path.join(__dirname, '../../staging');
const DATE_COLS = ['_extraido_en', 'fecha_publicacion'];

function loadLatestRaw(source: string): any[] {
  const dir = path.join(RAW_DIR, source);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.includes('extension_export'))
    .sort()
    .reverse();

  if (!files.length) return [];

  const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'));
  console.log(`  Cargado ${source}: ${data.length} registros (${files[0]})`);
  return data;
}

async function runStaging() {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const rates = loadRates();
  const sources = ['mercadolibre', 'aliexpress', 'temu', 'shein'];

  console.log('\n══ Iniciando Staging ══');
  let allRecords: any[] = [];

  for (const source of sources) {
    console.log(`\nProcesando: ${source}`);
    const raw = loadLatestRaw(source);
    if (!raw.length) {
      console.warn(`  ⚠ Sin datos para ${source}`);
      continue;
    }

    const processed = raw.map((record: any) => {
      try {
        // 1. Normalizar nombres de columnas (homologación inter-fuentes)
        let r = normalizeColumns(record);

        // 2. Estandarizar fechas a YYYY-MM-DD
        r = standardizeDates(r, DATE_COLS);

        // 3. Limpiar precio y convertir a USD
        const moneda = r.moneda ?? 'USD';
        r.precio_usd = cleanAndConvertToUsd(r.precio_raw, moneda, rates);

        // 4. Estandarizar strings a UTF-8 NFC
        for (const key of Object.keys(r)) {
          if (typeof r[key] === 'string') {
            r[key] = r[key].trim().normalize('NFC');
          }
        }

        // 5. Clasificar categoría
        r.categoria_normalizada = classifyCategory(r.titulo_oferta ?? null);

        return r;
      } catch (err: any) {
        logError(source, 'TransformError', err.message, 'Registro omitido');
        return null;
      }
    }).filter(Boolean);

    allRecords.push(...processed);
  }

  console.log(`\nTotal antes de deduplicar: ${allRecords.length}`);

  // 6. Deduplicar por clave compuesta
  const { data: deduped, removed } = deduplicate(allRecords, ['titulo_oferta', 'precio_raw', '_fuente']);
  console.log(`Duplicados eliminados: ${removed}`);
  console.log(`Total staging: ${deduped.length}`);

  const outFile = path.join(STAGING_DIR, 'all_products.json');
  fs.writeFileSync(outFile, JSON.stringify(deduped, null, 2), 'utf-8');
  console.log(`\n✓ Staging guardado: ${outFile}`);
}

runStaging().catch(err => {
  logError('staging', 'FatalError', err.message, 'Pipeline detenido');
  process.exit(1);
});
