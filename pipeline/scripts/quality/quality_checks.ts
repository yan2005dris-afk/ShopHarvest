import * as fs from 'fs';
import * as path from 'path';
import { logError } from './logger';

const STAGING_FILE = path.join(__dirname, '../../staging/all_products.json');
const REPORT_FILE  = path.join(__dirname, '../../staging/quality_report.json');

// ── 7.1 Duplicados ──────────────────────────────────────────────────────────
function checkDuplicates(records: any[], keyCols: string[]) {
  const seen = new Set<string>();
  const deduped = records.filter(r => {
    const key = keyCols.map(c => String(r[c] ?? '').toLowerCase()).join('||');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const removed = records.length - deduped.length;

  console.log('\n[7.1 DUPLICADOS]');
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

function checkNulls(records: any[], rules: NullRule[]) {
  console.log('\n[7.2 NULOS]');
  const matrix: Record<string, any> = {};
  let criticalRemoved = 0;

  for (const rule of rules) {
    const nullCount = records.filter(r => r[rule.col] == null || r[rule.col] === '').length;
    const pct = ((nullCount / records.length) * 100).toFixed(1);
    matrix[rule.col] = { fuente: rule.fuente, nullCount, pct: `${pct}%`, strategy: rule.strategy };

    console.log(`  ${rule.col} (${rule.fuente}): ${pct}% nulos → ${rule.strategy}`);

    if (rule.strategy === 'eliminar') criticalRemoved += nullCount;
  }

  const clean = records.filter(r => r.titulo_oferta != null && r.titulo_oferta !== '');
  return { clean, criticalRemoved, matrix };
}

// ── 7.3 Formatos y Casting ───────────────────────────────────────────────────
function checkFormats(records: any[]) {
  console.log('\n[7.3 FORMATOS Y CASTING]');
  let cleaned = 0;
  let unparseable = 0;

  for (const r of records) {
    if (typeof r.precio_raw === 'string' && r.precio_usd == null) {
      const before = r.precio_raw;
      const cleaned_str = before
        .replace(/[^\d.,k]/gi, '')
        .replace(/,(\d{2})$/, '.$1')
        .replace(/,/g, '')
        .replace(/k$/i, '000');
      const parsed = parseFloat(cleaned_str);

      if (!isNaN(parsed)) {
        r.precio_usd = Math.round(parsed * 100) / 100;
        cleaned++;
        console.log(`  Antes: "${before}" → Después: ${r.precio_usd} USD`);
      } else {
        r.precio_usd = null;
        unparseable++;
        logError('staging', 'FormatoInvalido', `precio no parseable: "${before}"`, 'Campo nulificado');
      }
    }
  }

  console.log(`  Precios limpiados: ${cleaned} | No parseables: ${unparseable}`);
  return records;
}

// ── 7.4 Estandarización ──────────────────────────────────────────────────────
function standardize(records: any[]) {
  console.log('\n[7.4 ESTANDARIZACIÓN]');
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

  console.log(`  Campos normalizados a UTF-8 NFC: ${normalized}`);
  return result;
}

// ── 7.5 Homologación — documentada en stg_normalize_columns.ts ──────────────
// titulo_oferta ← title (ML) | product_title (Ali) | nombre (Temu) | titulo (Shein)
// precio_raw    ← price (ML) | sale_price (Ali) | precio (Temu/Shein)

// ── 7.6 Log de errores — activo en toda la ejecución (ver logger.ts) ─────────

// ── 7.7 Reporte final de métricas ───────────────────────────────────────────
function generateReport(params: {
  totalRaw: number;
  totalStaging: number;
  duplicatesRemoved: number;
  criticalNullsRemoved: number;
  nullMatrix: Record<string, any>;
  sourceBreakdown: Record<string, number>;
}) {
  const { totalRaw, totalStaging, duplicatesRemoved, criticalNullsRemoved, nullMatrix, sourceBreakdown } = params;
  const completeness = ((totalStaging / totalRaw) * 100).toFixed(1);
  const errorRate = (100 - parseFloat(completeness)).toFixed(1);

  const errorRateBySource: Record<string, string> = {};
  for (const [src, count] of Object.entries(sourceBreakdown)) {
    errorRateBySource[src] = count > 0
      ? (((count - totalStaging) / count) * 100).toFixed(1) + '%'
      : 'N/A';
  }

  const report = {
    total_registros_raw:            totalRaw,
    total_registros_staging:        totalStaging,
    tasa_completitud:               `${completeness}%`,
    registros_depurados_duplicados: duplicatesRemoved,
    registros_eliminados_nulos:     criticalNullsRemoved,
    tasa_error_promedio:            `${errorRate}%`,
    error_rate_by_source:           errorRateBySource,
    null_matrix:                    nullMatrix,
    generated_at:                   new Date().toISOString(),
  };

  console.log('\n══════════════════ REPORTE FINAL DE CALIDAD ══════════════════');
  console.table({
    'Total registros Raw procesados':          totalRaw,
    'Total registros Staging aptos':           totalStaging,
    'Tasa de completitud general':             `${completeness}%`,
    'Registros depurados por duplicados':      duplicatesRemoved,
    'Registros eliminados por nulos críticos': criticalNullsRemoved,
    'Tasa de error promedio por fuente':       `${errorRate}%`,
  });

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✓ Reporte guardado: ${REPORT_FILE}`);
  return report;
}

// ── Ejecución principal ──────────────────────────────────────────────────────
function runQualityChecks() {
  if (!fs.existsSync(STAGING_FILE)) {
    console.error(`Error: ${STAGING_FILE} no existe. Ejecuta primero: npm run staging`);
    process.exit(1);
  }

  const records: any[] = JSON.parse(fs.readFileSync(STAGING_FILE, 'utf-8'));
  const totalRaw = records.length;

  const sourceBreakdown = records.reduce((acc: Record<string, number>, r: any) => {
    const src = r._fuente ?? 'desconocido';
    acc[src] = (acc[src] ?? 0) + 1;
    return acc;
  }, {});

  // 7.1
  const { deduped, removed: duplicatesRemoved } = checkDuplicates(
    records,
    ['titulo_oferta', 'precio_raw', '_fuente'],
  );

  // 7.2
  const { clean, criticalRemoved, matrix: nullMatrix } = checkNulls(deduped, [
    { col: 'precio_raw',    fuente: 'MercadoLibre', strategy: 'mediana' },
    { col: 'titulo_oferta', fuente: 'AliExpress',   strategy: 'eliminar' },
    { col: 'categoria',     fuente: 'Temu',          strategy: 'clasificar' },
  ]);

  // 7.3
  const formatted = checkFormats(clean);

  // 7.4
  const standardized = standardize(formatted);

  const outClean = path.join(path.dirname(STAGING_FILE), 'all_products_clean.json');
  fs.writeFileSync(outClean, JSON.stringify(standardized, null, 2), 'utf-8');
  console.log(`\n✓ Datos limpios guardados: ${outClean}`);

  // 7.7
  generateReport({
    totalRaw,
    totalStaging: standardized.length,
    duplicatesRemoved,
    criticalNullsRemoved: criticalRemoved,
    nullMatrix,
    sourceBreakdown,
  });
}

runQualityChecks();
