// ============================================================
// Carga ETL: Staging → Data Warehouse
// Entregable 4: Data Warehouse y Analítica
// Lee archivos JSON de staging/ y carga en esquema dw
//
// DUAL USE — both callable as a CLI and as a pure module:
//   - CLI:    `npx ts-node scripts/dw/dw_load_staging.ts`
//             → standalone run; creates its own PrismaClient
//   - Module: `import { runEtl } from '.../dw_load_staging'`
//             → caller injects PrismaClient (NestJS DwLoaderAdapter)
//
// The module export branch has NO top-level side effects. The CLI
// branch (gated by `require.main === module`) instantiates the client
// and disconnects explicitly.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import type { LoadResult } from '@web-scraping/contracts/pipeline';

// ── Logging ──────────────────────────────────────────────
function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Dimensiones de referencia ────────────────────────────

const FUENTES = [
  { nombre: 'mercadolibre', tipo: 'scraping', desc: 'MercadoLibre Ecuador - Scraping Playwright' },
  { nombre: 'aliexpress',   tipo: 'scraping', desc: 'AliExpress (books.toscrape.com) - Scraping Playwright' },
  { nombre: 'temu',         tipo: 'scraping', desc: 'Temu - Extracción vía Extensión Chrome' },
  { nombre: 'shein',        tipo: 'scraping', desc: 'Shein - Extracción vía Extensión Chrome' },
  { nombre: 'archivos',     tipo: 'archivo',  desc: 'Dataset Kaggle E-Commerce - Archivo CSV estructurado' },
];

const CATEGORIAS = [
  { nombre: 'electronica', desc: 'Dispositivos electrónicos, computación y accesorios tecnológicos' },
  { nombre: 'hogar',       desc: 'Productos para el hogar, cocina y decoración' },
  { nombre: 'moda',        desc: 'Ropa, calzado y accesorios de moda' },
  { nombre: 'ropa',        desc: 'Prendas de vestir en general' },
  { nombre: 'belleza',     desc: 'Cosméticos, cuidado personal y perfumería' },
  { nombre: 'juguetes',    desc: 'Juguetes, juegos y entretenimiento' },
  { nombre: 'deportes',    desc: 'Artículos deportivos y fitness' },
  { nombre: 'otros',       desc: 'Productos sin clasificación específica' },
];

const MONEDAS = [
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
  { codigo: 'GBP', nombre: 'Libra esterlina',      simbolo: '£' },
  { codigo: 'EUR', nombre: 'Euro',                 simbolo: '€' },
];

const CALIFICACIONES = [
  { nivel: 'One',   valor: 1 },
  { nivel: 'Two',   valor: 2 },
  { nivel: 'Three', valor: 3 },
  { nivel: 'Four',  valor: 4 },
  { nivel: 'Five',  valor: 5 },
];

const GENEROS = [
  { nombre: 'Masculino', abrev: 'M' },
  { nombre: 'Femenino',  abrev: 'F' },
];

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Staging file paths ───────────────────────────────────
// Absolute paths resolved lazily against either:
//   - cwd = `backend/`           (NestJS runtime / `npm run pipeline`)
//   - cwd = `backend/pipeline/`  (`cd backend/pipeline && npx ts-node`)
// so the script works from both invocation sites.
const STAGING_PRODUCTS_BASENAME = 'all_products_clean.json';
const STAGING_ENCUESTA_BASENAME = 'stg_encuesta_clean.json';
const STAGING_DIR_BASENAME = 'staging';

// ── Helpers ──────────────────────────────────────────────

async function ensureDim(
  prisma: PrismaClient,
  insertSql: string,
  values: ReadonlyArray<unknown>,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(insertSql, ...values);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? '';
    // Ignore duplicate-key errors (idempotent ON CONFLICT DO NOTHING).
    if (!msg.includes('violates unique constraint')) {
      throw err;
    }
  }
}

async function getDimId(
  prisma: PrismaClient,
  table: string,
  whereCol: string,
  whereVal: unknown,
): Promise<number | null> {
  const shortName = table.replace('dw.dim_', '');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id_${shortName} AS id FROM ${table} WHERE ${whereCol} = $1 LIMIT 1`,
    whereVal,
  );
  return rows[0]?.id ?? null;
}

// ── Carga de Dimensiones (PUBLIC API) ────────────────────
// Each `load*` is exported so the dw-loader.adapter (and unit tests)
// can call them individually. `runEtl` orchestrates them.

export async function loadDimFuente(prisma: PrismaClient): Promise<void> {
  log('Cargando DimFuente...');
  for (const f of FUENTES) {
    await ensureDim(
      prisma,
      `INSERT INTO dw.dim_fuente (nombre_fuente, tipo_fuente, descripcion)
       VALUES ($1, $2, $3) ON CONFLICT (nombre_fuente) DO NOTHING`,
      [f.nombre, f.tipo, f.desc],
    );
  }
  log(`  ${FUENTES.length} fuentes cargadas`);
}

export async function loadDimCategoria(prisma: PrismaClient): Promise<void> {
  log('Cargando DimCategoria...');
  for (const c of CATEGORIAS) {
    await ensureDim(
      prisma,
      `INSERT INTO dw.dim_categoria (nombre_categoria, descripcion)
       VALUES ($1, $2) ON CONFLICT (nombre_categoria) DO NOTHING`,
      [c.nombre, c.desc],
    );
  }
  log(`  ${CATEGORIAS.length} categorías cargadas`);
}

export async function loadDimMoneda(prisma: PrismaClient): Promise<void> {
  log('Cargando DimMoneda...');
  for (const m of MONEDAS) {
    await ensureDim(
      prisma,
      `INSERT INTO dw.dim_moneda (codigo_moneda, nombre_moneda, simbolo)
       VALUES ($1, $2, $3) ON CONFLICT (codigo_moneda) DO NOTHING`,
      [m.codigo, m.nombre, m.simbolo],
    );
  }
  log(`  ${MONEDAS.length} monedas cargadas`);
}

export async function loadDimCalificacion(prisma: PrismaClient): Promise<void> {
  log('Cargando DimCalificacion...');
  for (const c of CALIFICACIONES) {
    await ensureDim(
      prisma,
      `INSERT INTO dw.dim_calificacion (nivel, valor_numerico)
       VALUES ($1, $2) ON CONFLICT (nivel) DO NOTHING`,
      [c.nivel, c.valor],
    );
  }
  log(`  ${CALIFICACIONES.length} niveles cargados`);
}

export async function loadDimGenero(prisma: PrismaClient): Promise<void> {
  log('Cargando DimGenero...');
  for (const g of GENEROS) {
    await ensureDim(
      prisma,
      `INSERT INTO dw.dim_genero (nombre_genero, abreviatura)
       VALUES ($1, $2) ON CONFLICT (nombre_genero) DO NOTHING`,
      [g.nombre, g.abrev],
    );
  }
  log(`  ${GENEROS.length} géneros cargados`);
}

export async function loadDimTiempo(prisma: PrismaClient, fechas: Set<string>): Promise<void> {
  log('Cargando DimTiempo...');
  let count = 0;
  for (const f of fechas) {
    if (!f) continue;
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) continue;
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    const dia = d.getDate();
    const trim = Math.ceil(mes / 3);
    await ensureDim(
      prisma,
      `INSERT INTO dw.dim_tiempo (fecha_completa, anio, mes, dia, trimestre, nombre_mes)
       VALUES ($1::date, $2, $3, $4, $5, $6) ON CONFLICT (fecha_completa) DO NOTHING`,
      [f, anio, mes, dia, trim, NOMBRES_MES[mes - 1]],
    );
    count++;
  }
  log(`  ${count} fechas cargadas`);
}

// ── Carga de Hechos ──────────────────────────────────────

export async function loadFactProductos(
  prisma: PrismaClient,
  data: ReadonlyArray<Record<string, unknown>>,
): Promise<{ inserted: number; skipped: number }> {
  log(`Cargando FactProductos (${data.length} registros de staging)...`);

  let inserted = 0;
  let skipped = 0;

  for (const item of data) {
    if (!item['titulo_oferta']) {
      skipped++;
      continue;
    }

    // Try insert dim_producto; if it fails (rare, since there's no
    // UNIQUE on titulo_oferta today) fall back to lookup.
    let idProducto: number | null = null;
    try {
      const result = await prisma.$queryRawUnsafe<Array<{ id_producto: number }>>(
        `INSERT INTO dw.dim_producto (titulo_oferta, url_producto, disponibilidad)
         VALUES ($1, $2, $3)
         RETURNING id_producto`,
        item['titulo_oferta'],
        item['url_producto'] ?? null,
        item['disponibilidad'] ?? null,
      );
      idProducto = result[0]?.id_producto ?? null;
    } catch {
      idProducto = await getDimId(prisma, 'dw.dim_producto', 'titulo_oferta', item['titulo_oferta']);
    }

    if (!idProducto) {
      skipped++;
      continue;
    }

    const nombreFuente = ((item['_fuente'] as string | undefined) ?? 'archivos').toLowerCase();
    const nombreCategoria = ((item['categoria_normalizada'] as string | undefined) ??
      (item['_categoria'] as string | undefined) ??
      'otros').toLowerCase();
    const codigoMoneda = ((item['moneda'] as string | undefined) ?? 'USD').toUpperCase();
    const fechaStr = (item['_extraido_en'] as string | undefined) ?? '2026-06-30';
    const nivelCalif = (item['calificacion'] as string | undefined) ?? null;

    const idFuente = await getDimId(prisma, 'dw.dim_fuente', 'nombre_fuente', nombreFuente);
    const idCategoria = await getDimId(prisma, 'dw.dim_categoria', 'nombre_categoria', nombreCategoria);
    const idTiempo = await getDimId(prisma, 'dw.dim_tiempo', 'fecha_completa::text', fechaStr);
    const idMoneda = await getDimId(prisma, 'dw.dim_moneda', 'codigo_moneda', codigoMoneda);

    if (!idFuente || !idCategoria || !idTiempo || !idMoneda) {
      skipped++;
      continue;
    }

    let idCalificacion: number | null = null;
    if (nivelCalif) {
      idCalificacion = await getDimId(prisma, 'dw.dim_calificacion', 'nivel', nivelCalif);
    }

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO dw.fact_productos
         (id_producto, id_fuente, id_categoria, id_tiempo, id_moneda, id_calificacion, precio_usd, precio_raw, disponibilidad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        idProducto,
        idFuente,
        idCategoria,
        idTiempo,
        idMoneda,
        idCalificacion,
        item['precio_usd'] ?? null,
        item['precio_raw'] ? String(item['precio_raw']) : null,
        item['disponibilidad'] ?? null,
      );
      inserted++;
    } catch (err) {
      log(`  Error insertando hecho: ${(err as Error).message?.slice(0, 100)}`);
      skipped++;
    }
  }

  log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
  return { inserted, skipped };
}

export async function loadFactEncuesta(
  prisma: PrismaClient,
  data: ReadonlyArray<Record<string, unknown>>,
): Promise<{ inserted: number; skipped: number }> {
  log(`Cargando FactEncuestaConsumo (${data.length} registros de encuesta)...`);

  const sitioMap: Record<string, string> = {
    MercadoLibre: 'mercadolibre',
    AliExpress: 'aliexpress',
    Temu: 'temu',
    Shein: 'shein',
  };

  let inserted = 0;
  let skipped = 0;

  for (const item of data) {
    const idGenero = await getDimId(prisma, 'dw.dim_genero', 'nombre_genero', item['genero'] ?? 'Masculino');
    const nombreSitio =
      sitioMap[(item['sitio_preferido'] as string | undefined) ?? ''] ?? 'archivos';
    const idSitio = await getDimId(prisma, 'dw.dim_fuente', 'nombre_fuente', nombreSitio);

    if (!idGenero || !idSitio) {
      skipped++;
      continue;
    }

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO dw.fact_encuesta_consumo
         (id_genero, id_sitio_preferido, edad, frecuencia_compra, gasto_promedio_mensual, motivo_compra)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        idGenero,
        idSitio,
        item['edad'] ? parseInt(String(item['edad']), 10) : null,
        item['frecuencia_compra'] ?? null,
        item['gasto_promedio_mensual'] ?? null,
        item['motivo_compra'] ?? null,
      );
      inserted++;
    } catch (err) {
      log(`  Error insertando encuesta: ${(err as Error).message?.slice(0, 100)}`);
      skipped++;
    }
  }

  log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
  return { inserted, skipped };
}

// ── Orchestrator (PUBLIC API) ────────────────────────────

/**
 * Run the full ETL (staging JSON → dw.* tables).
 *
 * @param prisma      Injected PrismaClient (caller-managed). When this
 *                    function is invoked as a CLI the entrypoint below
 *                    constructs the client; when imported (NestJS) the
 *                    adapter passes its PrismaService.
 * @param opts.truncateFirst
 *                    When true, executes TRUNCATE CASCADE on
 *                    dw.fact_productos, dw.fact_encuesta_consumo and
 *                    dw.dim_producto BEFORE inserting facts. This makes
 *                    subsequent runs idempotent (counts reproducible).
 *                    When false, ON CONFLICT DO NOTHING on dimensions
 *                    keeps existing rows; new fact rows are appended.
 *
 *                    The dim_producto table currently has no UNIQUE on
 *                    titulo_oferta, so non-truncate runs may still
 *                    duplicate dim rows on repeated re-runs — that is
 *                    the bug PLAN_E5 §1.1 explicitly asks the loader
 *                    to acknowledge via the truncation switch.
 */
export async function runEtl(
  prisma: PrismaClient,
  opts: { stagingDir?: string; truncateFirst?: boolean } = {},
): Promise<LoadResult> {
  const start = Date.now();
  try {
    log('═══════════════════════════════════════════');
    log('CARGA DEL DW — runEtl');
    log('═══════════════════════════════════════════');

    // Resolve staging JSON paths against the current cwd (or the script's
    // __dirname fallback chain). When called from the NestJS adapter the
    // cwd is `backend/`, so `pipeline/staging/*` resolves correctly. When
    // called from the CLI in `backend/pipeline/`, the fallback chain finds
    // the same files via `../staging/*` or via the absolute `backend/`
    // ancestor.
    const { productosPath, encuestaPath, cwd } = resolveStagingPaths();
    log(`Staging cwd: ${cwd}`);

    if (opts.truncateFirst) {
      log('truncateFirst=true → TRUNCATE dw.fact_*, dw.dim_producto CASCADE');
      // CASCADE wipes rows referencing them (none for facts, but
      // TRUNCATE RESTART IDENTITY also resets the SERIAL counters).
      // dim_producto is truncated because it has no UNIQUE on
      // titulo_oferta today; loading twice without truncate would
      // produce duplicate dim rows and downstream COUNT() diverges.
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE dw.fact_productos, dw.fact_encuesta_consumo, dw.dim_producto RESTART IDENTITY CASCADE',
      );
    }

    const productos: Array<Record<string, unknown>> = JSON.parse(
      fs.readFileSync(productosPath, 'utf-8'),
    );
    const encuesta: Array<Record<string, unknown>> = JSON.parse(
      fs.readFileSync(encuestaPath, 'utf-8'),
    );

    log('Cargando dimensiones...');
    await loadDimFuente(prisma);
    await loadDimCategoria(prisma);
    await loadDimMoneda(prisma);
    await loadDimCalificacion(prisma);
    await loadDimGenero(prisma);

    const fechas = new Set<string>();
    for (const p of productos) {
      const v = p['_extraido_en'];
      if (typeof v === 'string' && v.length > 0) {
        fechas.add(v);
      }
    }
    await loadDimTiempo(prisma, fechas);

    log('Cargando tablas de hechos...');
    const prod = await loadFactProductos(prisma, productos);
    const enc = await loadFactEncuesta(prisma, encuesta);

    const elapsed = Date.now() - start;
    log(`Carga completada en ${elapsed} ms`);
    return {
      productosCargados: prod.inserted,
      encuestasCargadas: enc.inserted,
      tiempoMs: elapsed,
      estado: 'completado',
    };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    log(`Carga del DW fallida: ${message}`);
    return {
      productosCargados: 0,
      encuestasCargadas: 0,
      tiempoMs: Date.now() - start,
      estado: 'fallido',
      error: message.slice(0, 500),
    };
  }
}

// ── CLI auto-execution ───────────────────────────────────

/**
 * Resolves staging JSON against a list of candidate cwds so the same
 * script works when invoked from either `backend/` (NestJS startup) or
 * `backend/pipeline/` (CLI with `cd`). The shell script convention is
 * `cd backend/pipeline && npx ts-node scripts/dw/dw_load_staging.ts` —
 * we accept both for the natural ergonomics.
 */
function resolveStagingPaths(): {
  productosPath: string;
  encuestaPath: string;
  stagingDir: string;
  cwd: string;
} {
  // Possible roots in priority order:
  const roots: Array<{ root: string; stagingDir: string }> = [
    { root: process.cwd(),                                       stagingDir: path.join(process.cwd(), 'pipeline/staging') },
    { root: path.resolve(__dirname, '../../'),                   stagingDir: path.resolve(__dirname, '../../pipeline/staging') },
    { root: path.resolve(__dirname, '../../../'),                stagingDir: path.resolve(__dirname, '../../../pipeline/staging') },
  ];
  for (const { root, stagingDir } of roots) {
    const productosPath = path.join(stagingDir, STAGING_PRODUCTS_BASENAME);
    const encuestaPath = path.join(stagingDir, STAGING_ENCUESTA_BASENAME);
    if (fs.existsSync(productosPath) && fs.existsSync(encuestaPath)) {
      return { productosPath, encuestaPath, stagingDir, cwd: root };
    }
  }
  throw new Error(
    `Staging JSON not found. Looked under:\n  ${roots
      .map((r) => r.stagingDir)
      .join('\n  ')}\nRun \`npm run staging\` (or stage manually) first.`,
  );
}

function readStagingFiles(): { productos: any[]; encuesta: any[]; stagingDirHint: string } {
  const { productosPath, encuestaPath, stagingDir } = resolveStagingPaths();
  return {
    productos: JSON.parse(fs.readFileSync(productosPath, 'utf-8')),
    encuesta: JSON.parse(fs.readFileSync(encuestaPath, 'utf-8')),
    stagingDirHint: stagingDir,
  };
}

/**
 * Standalone entrypoint. Not exported — only the `require.main === module`
 * block at the bottom invokes it. Loading this file from another module
 * imports only the public functions; no side effects fire.
 */
async function main(truncateFirst: boolean): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
  });
  try {
    // Sanity-check staging presence early so a CLI run surfaces a clear
    // error before connecting.
    readStagingFiles();
    const result = await runEtl(prisma, { truncateFirst });
    log('═══════════════════════════════════════════');
    log('RESUMEN DE CARGA');
    log('═══════════════════════════════════════════');
    log(`  Productos cargados en FactProductos: ${result.productosCargados}`);
    log(`  Encuestas cargadas en FactEncuesta:  ${result.encuestasCargadas}`);
    log(`  Tiempo total:                        ${result.tiempoMs} ms`);
    log(`  Estado:                              ${result.estado}`);
    if (result.error) {
      log(`  Error: ${result.error}`);
    }
    log('═══════════════════════════════════════════');
    if (result.estado !== 'completado') {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const truncateFirst = process.argv.includes('--truncate') || process.env['TRUNCATE'] === '1';
  main(truncateFirst).catch((err) => {
    console.error('❌ Error durante la carga del DW:', err);
    process.exit(1);
  });
}
