import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DwLoaderService — staging → DW ETL trigger.
 *
 * Reads `backend/pipeline/staging/all_products_clean.json` and
 * `backend/pipeline/staging/stg_encuesta_clean.json` and replicates the
 * exact logic of `backend/pipeline/scripts/dw/dw_load_staging.ts`
 * (which is NOT a module — it's a CLI script invoked with `npx ts-node`).
 *
 * Why duplicate the logic in a NestJS service instead of shelling out
 * to the CLI? Because the dashboard needs to refresh the DW via a
 * single HTTP call (`POST /api/analytics/load`) without a subprocess;
 * shelling out would break the auditability contract in PLAN §4.5
 * (no `fs.readFile` from non-loader code) and complicate error handling.
 *
 * The logic was already validated end-to-end against the local DW
 * (commit 92541d3) so we trust the SQL here verbatim. Any change must
 * be made in lock-step with the CLI script.
 */
@Injectable()
export class DwLoaderService {
  private readonly logger = new Logger(DwLoaderService.name);

  // The path is resolved relative to the backend working directory
  // (`process.cwd()` when Nest starts is `backend/`). The CLI script
  // uses `path.join(__dirname, '../../staging/...')` which resolves to
  // `backend/pipeline/staging/...` from the script's perspective — but
  // at runtime we want the same files the pipeline wrote. The Dockerfile
  // and the CI run `backend/` as cwd, so this relative path is stable.
  private static readonly STAGING_PRODUCTS =
    'pipeline/staging/all_products_clean.json';
  private static readonly STAGING_ENCUESTA =
    'pipeline/staging/stg_encuesta_clean.json';

  // ── Dimensiones de referencia (verbatim from dw_load_staging.ts) ──
  private static readonly FUENTES = [
    { nombre: 'mercadolibre', tipo: 'scraping', desc: 'MercadoLibre Ecuador - Scraping Playwright' },
    { nombre: 'aliexpress',   tipo: 'scraping', desc: 'AliExpress (books.toscrape.com) - Scraping Playwright' },
    { nombre: 'temu',         tipo: 'scraping', desc: 'Temu - Extracción vía Extensión Chrome' },
    { nombre: 'shein',        tipo: 'scraping', desc: 'Shein - Extracción vía Extensión Chrome' },
    { nombre: 'archivos',     tipo: 'archivo',  desc: 'Dataset Kaggle E-Commerce - Archivo CSV estructurado' },
  ];

  private static readonly CATEGORIAS = [
    { nombre: 'electronica', desc: 'Dispositivos electrónicos, computación y accesorios tecnológicos' },
    { nombre: 'hogar',       desc: 'Productos para el hogar, cocina y decoración' },
    { nombre: 'moda',        desc: 'Ropa, calzado y accesorios de moda' },
    { nombre: 'ropa',        desc: 'Prendas de vestir en general' },
    { nombre: 'belleza',     desc: 'Cosméticos, cuidado personal y perfumería' },
    { nombre: 'juguetes',    desc: 'Juguetes, juegos y entretenimiento' },
    { nombre: 'deportes',    desc: 'Artículos deportivos y fitness' },
    { nombre: 'otros',       desc: 'Productos sin clasificación específica' },
  ];

  private static readonly MONEDAS = [
    { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
    { codigo: 'GBP', nombre: 'Libra esterlina',      simbolo: '£' },
    { codigo: 'EUR', nombre: 'Euro',                 simbolo: '€' },
  ];

  private static readonly CALIFICACIONES = [
    { nivel: 'One',   valor: 1 },
    { nivel: 'Two',   valor: 2 },
    { nivel: 'Three', valor: 3 },
    { nivel: 'Four',  valor: 4 },
    { nivel: 'Five',  valor: 5 },
  ];

  private static readonly GENEROS = [
    { nombre: 'Masculino', abrev: 'M' },
    { nombre: 'Femenino',  abrev: 'F' },
  ];

  private static readonly NOMBRES_MES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run the full ETL pipeline (staging JSON → dw.* tables).
   *
   * Wraps each step in try/catch so a partial failure (e.g. one bad row)
   * does not abort the whole batch. The caller receives either a
   * `{ productos_cargados, encuestas_cargadas, estado: 'completado', tiempo_ms }`
   * or a `{ error, estado: 'fallido' }` envelope so the frontend can
   * surface a toast without parsing a stack trace.
   */
  async run(opts: { truncate_first?: boolean } = {}): Promise<
    | {
        productos_cargados: number;
        encuestas_cargadas: number;
        estado: 'completado';
        tiempo_ms: number;
      }
    | { error: string; estado: 'fallido' }
  > {
    const start = Date.now();
    try {
      if (opts.truncate_first) {
        await this.truncateFacts();
      }

      const productos: Array<Record<string, unknown>> = JSON.parse(
        fs.readFileSync(DwLoaderService.STAGING_PRODUCTS, 'utf-8'),
      );
      const encuesta: Array<Record<string, unknown>> = JSON.parse(
        fs.readFileSync(DwLoaderService.STAGING_ENCUESTA, 'utf-8'),
      );

      this.logger.log('═══════════════════════════════════════════');
      this.logger.log('CARGA DEL DW — endpoint /api/analytics/load');
      this.logger.log('═══════════════════════════════════════════');

      this.logger.log('Cargando dimensiones…');
      await this.loadDimFuente();
      await this.loadDimCategoria();
      await this.loadDimMoneda();
      await this.loadDimCalificacion();
      await this.loadDimGenero();

      const fechas = new Set<string>();
      for (const p of productos) {
        const v = p['_extraido_en'];
        if (typeof v === 'string' && v.length > 0) {
          fechas.add(v);
        }
      }
      await this.loadDimTiempo(fechas);

      this.logger.log('Cargando tablas de hechos…');
      const prodCount = await this.loadFactProductos(productos);
      const encCount = await this.loadFactEncuesta(encuesta);

      const elapsed = Date.now() - start;
      this.logger.log(`Carga completada en ${elapsed} ms`);
      return {
        productos_cargados: prodCount,
        encuestas_cargadas: encCount,
        estado: 'completado',
        tiempo_ms: elapsed,
      };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.error(`Carga del DW fallida: ${message}`);
      return { error: message.slice(0, 500), estado: 'fallido' };
    }
  }

  // ── Helpers (verbatim from dw_load_staging.ts) ────────────────

  private async truncateFacts(): Promise<void> {
    this.logger.warn('truncate_first=true → TRUNCATE dw.fact_productos, dw.fact_encuesta_consumo');
    // TRUNCATE … RESTART IDENTITY resets the surrogate key counter; we
    // do NOT cascade into dim_* because dimensions are idempotent and
    // re-loaded below. Use $executeRawUnsafe for the multi-statement
    // batch — $executeRaw only accepts a single statement in Prisma 7.
    await this.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE dw.fact_productos, dw.fact_encuesta_consumo RESTART IDENTITY',
    );
  }

  private async ensureDim(
    insertSql: string,
    values: ReadonlyArray<unknown>,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(insertSql, ...values);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      // Ignore duplicate-key errors so the loader is idempotent on
      // re-run. Any other error rethrows.
      if (!msg.includes('violates unique constraint')) {
        throw err;
      }
    }
  }

  private async getDimId(
    table: string,
    whereCol: string,
    whereVal: unknown,
  ): Promise<number | null> {
    const shortName = table.replace('dw.dim_', '');
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id_${shortName} AS id FROM ${table} WHERE ${whereCol} = $1 LIMIT 1`,
      whereVal,
    );
    return rows[0]?.id ?? null;
  }

  private async loadDimFuente(): Promise<void> {
    for (const f of DwLoaderService.FUENTES) {
      await this.ensureDim(
        `INSERT INTO dw.dim_fuente (nombre_fuente, tipo_fuente, descripcion)
         VALUES ($1, $2, $3) ON CONFLICT (nombre_fuente) DO NOTHING`,
        [f.nombre, f.tipo, f.desc],
      );
    }
  }

  private async loadDimCategoria(): Promise<void> {
    for (const c of DwLoaderService.CATEGORIAS) {
      await this.ensureDim(
        `INSERT INTO dw.dim_categoria (nombre_categoria, descripcion)
         VALUES ($1, $2) ON CONFLICT (nombre_categoria) DO NOTHING`,
        [c.nombre, c.desc],
      );
    }
  }

  private async loadDimMoneda(): Promise<void> {
    for (const m of DwLoaderService.MONEDAS) {
      await this.ensureDim(
        `INSERT INTO dw.dim_moneda (codigo_moneda, nombre_moneda, simbolo)
         VALUES ($1, $2, $3) ON CONFLICT (codigo_moneda) DO NOTHING`,
        [m.codigo, m.nombre, m.simbolo],
      );
    }
  }

  private async loadDimCalificacion(): Promise<void> {
    for (const c of DwLoaderService.CALIFICACIONES) {
      await this.ensureDim(
        `INSERT INTO dw.dim_calificacion (nivel, valor_numerico)
         VALUES ($1, $2) ON CONFLICT (nivel) DO NOTHING`,
        [c.nivel, c.valor],
      );
    }
  }

  private async loadDimGenero(): Promise<void> {
    for (const g of DwLoaderService.GENEROS) {
      await this.ensureDim(
        `INSERT INTO dw.dim_genero (nombre_genero, abreviatura)
         VALUES ($1, $2) ON CONFLICT (nombre_genero) DO NOTHING`,
        [g.nombre, g.abrev],
      );
    }
  }

  private async loadDimTiempo(fechas: Set<string>): Promise<void> {
    let count = 0;
    for (const f of fechas) {
      if (!f) continue;
      const d = new Date(f);
      if (Number.isNaN(d.getTime())) continue;
      const anio = d.getFullYear();
      const mes = d.getMonth() + 1;
      const dia = d.getDate();
      const trim = Math.ceil(mes / 3);
      await this.ensureDim(
        `INSERT INTO dw.dim_tiempo (fecha_completa, anio, mes, dia, trimestre, nombre_mes)
         VALUES ($1::date, $2, $3, $4, $5, $6) ON CONFLICT (fecha_completa) DO NOTHING`,
        [f, anio, mes, dia, trim, DwLoaderService.NOMBRES_MES[mes - 1]],
      );
      count++;
    }
    this.logger.log(`  ${count} fechas cargadas`);
  }

  private async loadFactProductos(
    data: ReadonlyArray<Record<string, unknown>>,
  ): Promise<number> {
    this.logger.log(`  Leyendo ${data.length} productos de staging…`);
    let inserted = 0;
    let skipped = 0;

    for (const item of data) {
      if (!item['titulo_oferta']) {
        skipped++;
        continue;
      }

      // Upsert dim_producto by titulo_oferta
      let idProducto: number | null = null;
      try {
        const result = await this.prisma.$queryRawUnsafe<Array<{ id_producto: number }>>(
          `INSERT INTO dw.dim_producto (titulo_oferta, url_producto, disponibilidad)
           VALUES ($1, $2, $3)
           RETURNING id_producto`,
          item['titulo_oferta'],
          item['url_producto'] ?? null,
          item['disponibilidad'] ?? null,
        );
        idProducto = result[0]?.id_producto ?? null;
      } catch {
        idProducto = await this.getDimId(
          'dw.dim_producto',
          'titulo_oferta',
          item['titulo_oferta'],
        );
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

      const idFuente = await this.getDimId('dw.dim_fuente', 'nombre_fuente', nombreFuente);
      const idCategoria = await this.getDimId(
        'dw.dim_categoria',
        'nombre_categoria',
        nombreCategoria,
      );
      const idTiempo = await this.getDimId('dw.dim_tiempo', 'fecha_completa::text', fechaStr);
      const idMoneda = await this.getDimId('dw.dim_moneda', 'codigo_moneda', codigoMoneda);
      if (!idFuente || !idCategoria || !idTiempo || !idMoneda) {
        skipped++;
        continue;
      }

      let idCalificacion: number | null = null;
      if (nivelCalif) {
        idCalificacion = await this.getDimId('dw.dim_calificacion', 'nivel', nivelCalif);
      }

      try {
        await this.prisma.$executeRawUnsafe(
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
        const msg = (err as Error).message?.slice(0, 100);
        this.logger.warn(`  Error insertando hecho: ${msg}`);
        skipped++;
      }
    }

    this.logger.log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
    return inserted;
  }

  private async loadFactEncuesta(
    data: ReadonlyArray<Record<string, unknown>>,
  ): Promise<number> {
    this.logger.log(`  Leyendo ${data.length} encuestas de staging…`);
    const sitioMap: Record<string, string> = {
      MercadoLibre: 'mercadolibre',
      AliExpress: 'aliexpress',
      Temu: 'temu',
      Shein: 'shein',
    };

    let inserted = 0;
    let skipped = 0;

    for (const item of data) {
      const idGenero = await this.getDimId(
        'dw.dim_genero',
        'nombre_genero',
        item['genero'] ?? 'Masculino',
      );
      const nombreSitio =
        sitioMap[(item['sitio_preferido'] as string | undefined) ?? ''] ?? 'archivos';
      const idSitio = await this.getDimId('dw.dim_fuente', 'nombre_fuente', nombreSitio);

      if (!idGenero || !idSitio) {
        skipped++;
        continue;
      }

      try {
        await this.prisma.$executeRawUnsafe(
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
        const msg = (err as Error).message?.slice(0, 100);
        this.logger.warn(`  Error insertando encuesta: ${msg}`);
        skipped++;
      }
    }

    this.logger.log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
    return inserted;
  }
}