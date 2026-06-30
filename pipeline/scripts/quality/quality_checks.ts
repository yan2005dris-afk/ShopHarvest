import * as fs from 'fs';
import * as path from 'path';
import { logError } from './logger';

const STAGING_PRODUCTS_FILE = path.join(__dirname, '../../staging/all_products.json');
const STAGING_ENCUESTA_FILE = path.join(__dirname, '../../staging/stg_encuesta.json');
const REPORT_FILE  = path.join(__dirname, '../../staging/quality_report.json');

const RAW_SCRAPING_DIR = path.join(__dirname, '../../raw/scraping');
const RAW_ARCHIVOS_DIR = path.join(__dirname, '../../raw/archivos');
const RAW_ENCUESTA_DIR = path.join(__dirname, '../../raw/fuente_propia');

// ── 7.1 Duplicados ──────────────────────────────────────────────────────────
function checkDuplicates(records: any[], keyCols: string[], sourceLabel: string) {
  const seen = new Set<string>();
  const deduped = records.filter(r => {
    const key = keyCols.map(c => String(r[c] ?? '').toLowerCase()).join('||');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const removed = records.length - deduped.length;

  console.log(`\n[7.1 DUPLICADOS — ${sourceLabel}]`);
  console.log(`  Criterio de unicidad: ${keyCols.join(' + ')}`);
  console.log(`  Registros antes: ${records.length}`);
  console.log(`  Duplicados eliminados: ${removed}`);
  console.log(`  Registros únicos: ${deduped.length}`);

  return { deduped, removed };
}

// ── 7.2 Nulos ───────────────────────────────────────────────────────────────
interface NullRule {
  col: string;
  fuente: string;
  strategy: 'eliminar' | 'mediana' | 'inferir' | 'clasificar';
}

function checkNulls(records: any[], rules: NullRule[], criticalCol: string, sourceLabel: string) {
  console.log(`\n[7.2 NULOS — ${sourceLabel}]`);
  const matrix: Record<string, any> = {};
  
  for (const rule of rules) {
    const nullCount = records.filter(r => r[rule.col] == null || r[rule.col] === '').length;
    const pct = records.length > 0 ? ((nullCount / records.length) * 100).toFixed(1) : '0.0';
    matrix[rule.col] = { fuente: rule.fuente, nullCount, pct: `${pct}%`, strategy: rule.strategy };
    console.log(`  ${rule.col} (${rule.fuente}): ${pct}% nulos → ${rule.strategy}`);
  }

  // Filtrar nulos críticos
  const clean = records.filter(r => r[criticalCol] != null && r[criticalCol] !== '');
  const criticalRemoved = records.length - clean.length;
  console.log(`  Registros eliminados por nulo crítico en "${criticalCol}": ${criticalRemoved}`);

  return { clean, criticalRemoved, matrix };
}

// ── 7.3 Formatos y Casting ───────────────────────────────────────────────────
function checkFormats(records: any[]) {
  console.log('\n[7.3 FORMATOS Y CASTING — Productos]');
  let cleaned = 0;
  let unparseable = 0;

  for (const r of records) {
    if (r.precio_usd == null && r.precio_raw != null) {
      const before = String(r.precio_raw);
      const cleaned_str = before
        .replace(/[^\d.,k]/gi, '')
        .replace(/,(\d{2})$/, '.$1')
        .replace(/,/g, '')
        .replace(/k$/i, '000');
      const parsed = parseFloat(cleaned_str);

      if (!isNaN(parsed)) {
        r.precio_usd = Math.round(parsed * 100) / 100;
        cleaned++;
      } else {
        r.precio_usd = null;
        unparseable++;
        logError('staging', 'FormatoInvalido', `precio no parseable: "${before}"`, 'Campo nulificado');
      }
    }
  }

  console.log(`  Precios limpiados: ${cleaned} | No parseables (nulos): ${unparseable}`);
  return records;
}

// ── 7.4 Estandarización ──────────────────────────────────────────────────────
function standardize(records: any[]) {
  let normalized = 0;

  const result = records.map(r => {
    for (const key of Object.keys(r)) {
      if (typeof r[key] === 'string') {
        r[key] = r[key].trim().normalize('NFC'); // UTF-8 canónico
        normalized++;
      }
    }
    return r;
  });

  return { result, normalized };
}

// ── Contar Registros Crudos en Raw ───────────────────────────────────────────
function getRawCount(dirPath: string, prefix: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json') && f.startsWith(prefix) && !f.includes('extension_export'))
    .sort()
    .reverse();
  if (!files.length) return 0;
  const data = JSON.parse(fs.readFileSync(path.join(dirPath, files[0]), 'utf-8'));
  return data.length;
}

// ── Ejecución principal ──────────────────────────────────────────────────────
function runQualityChecks() {
  if (!fs.existsSync(STAGING_PRODUCTS_FILE)) {
    console.error(`Error: ${STAGING_PRODUCTS_FILE} no existe. Ejecuta primero: npm run staging`);
    process.exit(1);
  }

  // 1. Calcular recuentos de RAW reales
  const rawCounts: Record<string, number> = {
    mercadolibre: getRawCount(path.join(RAW_SCRAPING_DIR, 'mercadolibre'), 'mercadolibre'),
    aliexpress:   getRawCount(path.join(RAW_SCRAPING_DIR, 'aliexpress'), 'aliexpress'),
    temu:         getRawCount(path.join(RAW_SCRAPING_DIR, 'temu'), 'temu'),
    shein:        getRawCount(path.join(RAW_SCRAPING_DIR, 'shein'), 'shein'),
    archivos:     getRawCount(RAW_ARCHIVOS_DIR, 'dataset'),
    encuesta:     getRawCount(RAW_ENCUESTA_DIR, 'encuesta'),
  };

  const totalRawGlobal = Object.values(rawCounts).reduce((a, b) => a + b, 0);
  console.log(`\nRegistros Crudos Totales en Raw: ${totalRawGlobal}`);
  for (const [k, v] of Object.entries(rawCounts)) {
    console.log(`  - ${k}: ${v}`);
  }

  let totalDuplicatesRemoved = 0;
  let totalCriticalNullsRemoved = 0;
  let totalNormalizedFields = 0;
  let nullMatrixConsolidated: Record<string, any> = {};

  // 2. Procesar Productos
  const products: any[] = JSON.parse(fs.readFileSync(STAGING_PRODUCTS_FILE, 'utf-8'));
  
  // 7.1 Duplicados en Productos
  const { deduped: prodDeduped, removed: prodDupRemoved } = checkDuplicates(
    products,
    ['titulo_oferta', 'precio_raw', '_fuente'],
    'Productos'
  );
  
  // Sumar duplicados eliminados en la fase de Staging inicial para productos
  const prodPreDupRemoved = (rawCounts.mercadolibre + rawCounts.aliexpress + rawCounts.temu + rawCounts.shein + rawCounts.archivos) - products.length;
  totalDuplicatesRemoved += prodDupRemoved + prodPreDupRemoved;

  // 7.2 Nulos en Productos
  const { clean: prodClean, criticalRemoved: prodNullRemoved, matrix: prodNullMatrix } = checkNulls(
    prodDeduped,
    [
      { col: 'precio_raw',    fuente: 'mercadolibre', strategy: 'mediana' },
      { col: 'titulo_oferta', fuente: 'aliexpress',   strategy: 'eliminar' },
      { col: 'categoria',     fuente: 'temu',          strategy: 'clasificar' },
    ],
    'titulo_oferta',
    'Productos'
  );
  totalCriticalNullsRemoved += prodNullRemoved;
  nullMatrixConsolidated = { ...nullMatrixConsolidated, ...prodNullMatrix };

  // 7.3 Casting en Productos
  const prodFormatted = checkFormats(prodClean);

  // 7.4 Estandarización en Productos
  const { result: prodStandardized, normalized: prodNormCount } = standardize(prodFormatted);
  totalNormalizedFields += prodNormCount;

  // Guardar Productos Limpios
  const cleanProdFile = path.join(path.dirname(STAGING_PRODUCTS_FILE), 'all_products_clean.json');
  fs.writeFileSync(cleanProdFile, JSON.stringify(prodStandardized, null, 2), 'utf-8');
  console.log(`\n✓ Productos limpios guardados: ${cleanProdFile} (${prodStandardized.length} registros)`);

  // 3. Procesar Encuesta
  let encuestaCleanCount = 0;
  if (fs.existsSync(STAGING_ENCUESTA_FILE)) {
    const encuestas: any[] = JSON.parse(fs.readFileSync(STAGING_ENCUESTA_FILE, 'utf-8'));

    // 7.1 Duplicados en Encuestas
    const { deduped: encDeduped, removed: encDupRemoved } = checkDuplicates(
      encuestas,
      ['edad', 'genero', 'frecuencia_compra', 'sitio_preferido', 'gasto_promedio_mensual'],
      'Encuesta'
    );
    
    // Sumar duplicados de encuestas eliminados en Staging inicial
    const encPreDupRemoved = rawCounts.encuesta - encuestas.length;
    totalDuplicatesRemoved += encDupRemoved + encPreDupRemoved;

    // 7.2 Nulos en Encuestas
    const { clean: encClean, criticalRemoved: encNullRemoved, matrix: encNullMatrix } = checkNulls(
      encDeduped,
      [
        { col: 'gasto_promedio_mensual', fuente: 'fuente_propia', strategy: 'inferir' },
        { col: 'edad',                   fuente: 'fuente_propia', strategy: 'eliminar' },
      ],
      'edad',
      'Encuesta'
    );
    totalCriticalNullsRemoved += encNullRemoved;
    nullMatrixConsolidated = { ...nullMatrixConsolidated, ...encNullMatrix };

    // 7.4 Estandarización en Encuestas
    const { result: encStandardized, normalized: encNormCount } = standardize(encClean);
    totalNormalizedFields += encNormCount;
    encuestaCleanCount = encStandardized.length;

    // Guardar Encuesta Limpia
    const cleanEncFile = path.join(path.dirname(STAGING_ENCUESTA_FILE), 'stg_encuesta_clean.json');
    fs.writeFileSync(cleanEncFile, JSON.stringify(encStandardized, null, 2), 'utf-8');
    console.log(`✓ Encuesta limpia guardada: ${cleanEncFile} (${encStandardized.length} registros)`);
  }

  // 4. Reporte final
  const totalStagingGlobal = prodStandardized.length + encuestaCleanCount;
  const completeness = ((totalStagingGlobal / totalRawGlobal) * 100).toFixed(1);
  const errorRate = (100 - parseFloat(completeness)).toFixed(1);

  // Desglose de tasa de error por fuente
  const errorRateBySource: Record<string, string> = {};
  for (const [src, count] of Object.entries(rawCounts)) {
    if (src === 'encuesta') {
      errorRateBySource[src] = count > 0 
        ? (((count - encuestaCleanCount) / count) * 100).toFixed(1) + '%'
        : '0.0%';
    } else {
      const srcStaging = prodStandardized.filter(r => r._fuente === src).length;
      errorRateBySource[src] = count > 0
        ? (((count - srcStaging) / count) * 100).toFixed(1) + '%'
        : '0.0%';
    }
  }

  const report = {
    total_registros_raw:            totalRawGlobal,
    total_registros_staging:        totalStagingGlobal,
    tasa_completitud:               `${completeness}%`,
    registros_depurados_duplicados: totalDuplicatesRemoved,
    registros_eliminados_nulos:     totalCriticalNullsRemoved,
    tasa_error_promedio:            `${errorRate}%`,
    error_rate_by_source:           errorRateBySource,
    null_matrix:                    nullMatrixConsolidated,
    campos_normalizados_utf8:       totalNormalizedFields,
    generated_at:                   new Date().toISOString(),
  };

  console.log('\n══════════════════ REPORTE FINAL DE CALIDAD ══════════════════');
  console.table({
    'Total registros Raw procesados':          totalRawGlobal,
    'Total registros Staging aptos':           totalStagingGlobal,
    'Tasa de completitud general':             `${completeness}%`,
    'Registros depurados por duplicados':      totalDuplicatesRemoved,
    'Registros eliminados por nulos críticos': totalCriticalNullsRemoved,
    'Tasa de error promedio por fuente':       `${errorRate}%`,
  });

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✓ Reporte guardado: ${REPORT_FILE}`);
}

runQualityChecks();
