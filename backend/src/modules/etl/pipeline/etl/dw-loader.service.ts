/**
 * DwLoaderService — staging JSON → `dw.*` schema (ETL-2).
 *
 * Ported from legacy `legacy/pipeline/scripts/dw/dw_load_staging.ts`
 * (compiled output preserved at `legacy/pipeline/dist/`, source
 * deleted in PR 1b). Uses typed Prisma calls (`upsert`/`create`)
 * instead of the legacy's raw SQL — behaviorally equivalent (unique
 * fields give the same ON CONFLICT DO NOTHING semantics via
 * `upsert({ update: {} })`), but avoids `$queryRawUnsafe` string
 * interpolation and gets compile-time field checking. Dimension
 * lookups are pre-loaded into in-memory maps before the fact loop
 * instead of the legacy's per-row `$queryRawUnsafe` lookup (same
 * result, avoids an N+1 query pattern on large batches).
 *
 * Runs the quality gate (ETL-4) BEFORE any dw.* write: on a failed
 * QualityReport, `load()` returns `estado: 'fallido'` without calling
 * any dimension/fact upsert.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { IDwLoader, LoadResult } from '../interfaces';
import { AnalyticsPrismaService } from '../../../../common/prisma/analytics-prisma.service';
import { QualityService } from './quality.service';
import { OperationalPrismaService } from '../../../../common/prisma/operational-prisma.service';
import { RawCaptureStatus } from '../../../../generated/operational';
import {
  FUENTES,
  CATEGORIAS,
  MONEDAS,
  CALIFICACIONES,
  GENEROS,
  NOMBRES_MES,
} from './etl.constants';

interface ProductRow {
  titulo_oferta?: unknown;
  url_producto?: unknown;
  disponibilidad?: unknown;
  _fuente?: unknown;
  categoria_normalizada?: unknown;
  _categoria?: unknown;
  moneda?: unknown;
  _extraido_en?: unknown;
  calificacion?: unknown;
  precio_usd?: unknown;
  precio_raw?: unknown;
  _offerId?: unknown;
  _sourceId?: unknown;
}

interface EncuestaRow {
  genero?: unknown;
  sitio_preferido?: unknown;
  edad?: unknown;
  frecuencia_compra?: unknown;
  gasto_promedio_mensual?: unknown;
  motivo_compra?: unknown;
}

/** Safely coerce an unknown staging-row cell to a string, with a fallback for null/undefined. */
function toSafeString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
}

const SITIO_MAP: Readonly<Record<string, string>> = {
  MercadoLibre: 'mercadolibre',
  AliExpress: 'aliexpress',
  Temu: 'temu',
  Shein: 'shein',
};

@Injectable()
export class DwLoaderService implements IDwLoader {
  private readonly logger = new Logger(DwLoaderService.name);

  constructor(
    private readonly prisma: AnalyticsPrismaService,
    private readonly configService: ConfigService,
    private readonly qualityService: QualityService,
    private readonly operationalPrisma: OperationalPrismaService,
  ) {}

  /**
   * Normalize source names from staging data to match dim_fuente keys.
   * 'ec.shein.com' → 'shein', 'temu.com' → 'temu', 'mercadolibre.com.ec' → 'mercadolibre', 'csv_dataset' → 'csv_dataset'
   * 
   * Smart extraction: strips known public suffixes (.com, .com.ec, .org, etc.)
   * and country codes (ec, ar, mx, etc.) to find the brand name.
   */
  private normalizeSourceName(raw: string): string {
    const clean = raw.toLowerCase().trim();
    
    // Handle non-domain sources (e.g. 'csv_dataset', 'manual')
    if (!clean.includes('.')) {
      // Check if it's a known brand name directly
      const knownBrands = ['mercadolibre', 'aliexpress', 'temu', 'shein', 'amazon', 'ebay'];
      if (knownBrands.includes(clean)) return clean;
      return clean;
    }

    // Split domain into parts
    const parts = clean.split('.');
    
    // Known public suffixes (TLDs + country-code TLDs) to skip
    const publicSuffixes = new Set([
      'com', 'org', 'net', 'edu', 'gov', 'io', 'co',
      // Country-code TLDs
      'ec', 'ar', 'mx', 'cl', 'co', 'br', 'pe', 'uy', 'py', 've', 'gt', 'cr', 'pa', 'do', 'hn', 'ni', 'sv',
      'es', 'pt', 'fr', 'de', 'it', 'uk', 'ru', 'cn', 'jp', 'kr', 'in', 'au', 'nz', 'ca',
    ]);
    
    // Known brand name parts that might appear in domains (skip these too)
    const knownBrandParts = new Set(['www', 'm', 'mobile', 'api', 'app']);

    // Strategy: find the first part that's NOT a known suffix or known brand part
    // But for country-code TLDs like .com.ec, .com.ar, we need 2-level TLD handling
    // Algorithm: 
    // 1. If last part is a country code and second-to-last is 'com' or 'org', skip both
    // 2. Otherwise, skip the last part if it's a public suffix
    // 3. Take the first non-skipped part
    
    let skipCount = 0;
    const n = parts.length;
    
    if (n >= 2) {
      const last = parts[n - 1];
      const secondLast = parts[n - 2];
      
      // Handle 2-level TLDs like .com.ec, .com.ar, .com.mx
      if (publicSuffixes.has(last) && (secondLast === 'com' || secondLast === 'org' || secondLast === 'co')) {
        skipCount = 2;
      } else if (publicSuffixes.has(last)) {
        skipCount = 1;
      }
    }
    
    // Find the first part that's not a known skip or brand part
    for (let i = 0; i < n - skipCount; i++) {
      const part = parts[i];
      if (!publicSuffixes.has(part) && !knownBrandParts.has(part) && part.length > 1) {
        return part;
      }
    }
    
    // Fallback: take the first non-skipped part
    const effectiveParts = parts.slice(0, n > 0 ? Math.max(1, n - skipCount) : 1);
    return effectiveParts[0] || clean;
  }

  private async updateRawCapturesToProcessed(
    records: { offerId: string; sourceId: string }[],
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }
    this.logger.log(
      `Actualizando ${records.length} capturas a estado PROCESSED en la base de datos operacional...`,
    );
    await this.operationalPrisma.rawCapture.updateMany({
      where: {
        OR: records.map((r) => ({
          offerId: r.offerId,
          sourceId: r.sourceId,
        })),
      },
      data: {
        status: RawCaptureStatus.PROCESSED,
      },
    });
  }

  async load(opts?: {
    truncateFirst?: boolean;
    inMemoryData?: {
      productos?: Record<string, unknown>[];
      encuestas?: Record<string, unknown>[];
    };
  }): Promise<LoadResult> {
    const start = Date.now();
    try {
      let productos: ProductRow[];
      let encuestas: EncuestaRow[];

      if (opts?.inMemoryData) {
        productos = (opts.inMemoryData.productos || []) as ProductRow[];
        encuestas = (opts.inMemoryData.encuestas || []) as EncuestaRow[];
      } else {
        const envVal = this.configService.get<string>('PIPELINE_STAGING_DIR');
        const stagingDir = envVal
          ? envVal
          : path.join(path.resolve(__dirname, '../../../../'), 'pipeline/staging');
        productos = await this.readJsonArray<ProductRow>(
          path.join(stagingDir, 'all_products.json'),
        );
        encuestas = await this.readJsonArray<EncuestaRow>(
          path.join(stagingDir, 'stg_encuesta.json'),
        );
      }

      const report = this.qualityService.run(
        productos as Record<string, unknown>[],
      );
      if (report.state === 'failed') {
        const failedNames = report.checks
          .filter((c) => !c.passed)
          .map((c) => c.name)
          .join(', ');
        this.logger.error(
          `Quality gate failed (${failedNames}) — DW load aborted, no rows written`,
        );
        return {
          productosCargados: 0,
          encuestasCargadas: 0,
          tiempoMs: Date.now() - start,
          estado: 'fallido',
          error: `quality gate failed: ${failedNames}`,
        };
      }

      if (opts?.truncateFirst) {
        this.logger.log(
          'truncateFirst=true → TRUNCATE dw.fact_*, dw.dim_producto CASCADE',
        );
        await this.prisma.$executeRawUnsafe(
          'TRUNCATE TABLE dw.fact_productos, dw.fact_encuesta_consumo, dw.dim_producto RESTART IDENTITY CASCADE',
        );
      }

      this.logger.log('Cargando dimensiones...');
      await this.loadDimFuente();
      await this.loadDimCategoria();
      await this.loadDimMoneda();
      await this.loadDimCalificacion();
      await this.loadDimGenero();
      await this.loadDimTiempo(productos);

      this.logger.log('Cargando tablas de hechos...');
      const dims = await this.loadDimLookups();
      const prod = await this.loadFactProductos(productos, dims);
      const enc = await this.loadFactEncuesta(encuestas, dims);

      if (prod.loadedRecords.length > 0) {
        await this.updateRawCapturesToProcessed(prod.loadedRecords);
      }

      const tiempoMs = Date.now() - start;
      this.logger.log(`Carga completada en ${tiempoMs} ms`);

      return {
        productosCargados: prod.inserted,
        encuestasCargadas: enc.inserted,
        tiempoMs,
        estado: 'completado',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Carga del DW fallida: ${message}`);
      return {
        productosCargados: 0,
        encuestasCargadas: 0,
        tiempoMs: Date.now() - start,
        estado: 'fallido',
        error: message.slice(0, 500),
      };
    }
  }

  private async readJsonArray<T>(filePath: string): Promise<T[]> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data: unknown = JSON.parse(raw);
      return Array.isArray(data) ? (data as T[]) : [];
    } catch {
      return [];
    }
  }

  private async loadDimFuente(): Promise<void> {
    for (const f of FUENTES) {
      await this.prisma.dimFuente.upsert({
        where: { nombre_fuente: f.nombre },
        create: {
          nombre_fuente: f.nombre,
          tipo_fuente: f.tipo,
          descripcion: f.desc,
        },
        update: {},
      });
    }
    this.logger.log(`  ${FUENTES.length} fuentes cargadas`);
  }

  private async loadDimCategoria(): Promise<void> {
    for (const c of CATEGORIAS) {
      await this.prisma.dimCategoria.upsert({
        where: { nombre_categoria: c.nombre },
        create: { nombre_categoria: c.nombre, descripcion: c.desc },
        update: {},
      });
    }
    this.logger.log(`  ${CATEGORIAS.length} categorías cargadas`);
  }

  private async loadDimMoneda(): Promise<void> {
    for (const m of MONEDAS) {
      await this.prisma.dimMoneda.upsert({
        where: { codigo_moneda: m.codigo },
        create: {
          codigo_moneda: m.codigo,
          nombre_moneda: m.nombre,
          simbolo: m.simbolo,
        },
        update: {},
      });
    }
    this.logger.log(`  ${MONEDAS.length} monedas cargadas`);
  }

  private async loadDimCalificacion(): Promise<void> {
    for (const c of CALIFICACIONES) {
      await this.prisma.dimCalificacion.upsert({
        where: { nivel: c.nivel },
        create: { nivel: c.nivel, valor_numerico: c.valor },
        update: {},
      });
    }
    this.logger.log(`  ${CALIFICACIONES.length} niveles cargados`);
  }

  private async loadDimGenero(): Promise<void> {
    for (const g of GENEROS) {
      await this.prisma.dimGenero.upsert({
        where: { nombre_genero: g.nombre },
        create: { nombre_genero: g.nombre, abreviatura: g.abrev },
        update: {},
      });
    }
    this.logger.log(`  ${GENEROS.length} géneros cargados`);
  }

  private async loadDimTiempo(productos: ProductRow[]): Promise<void> {
    const fechas = new Set<string>();
    for (const p of productos) {
      const v = p['_extraido_en'];
      if (typeof v === 'string' && v.length > 0) fechas.add(v);
    }
    let count = 0;
    for (const f of fechas) {
      const d = new Date(f);
      if (Number.isNaN(d.getTime())) continue;
      const anio = d.getUTCFullYear();
      const mes = d.getUTCMonth() + 1;
      const dia = d.getUTCDate();
      const trimestre = Math.ceil(mes / 3);
      await this.prisma.dimTiempo.upsert({
        where: { fecha_completa: d },
        create: {
          fecha_completa: d,
          anio,
          mes,
          dia,
          trimestre,
          nombre_mes: NOMBRES_MES[mes - 1],
        },
        update: {},
      });
      count++;
    }
    this.logger.log(`  ${count} fechas cargadas`);
  }

  /** Pre-load every dimension into an in-memory map (avoids N+1 lookups in the fact loop). */
  private async loadDimLookups() {
    const [fuentes, categorias, monedas, calificaciones, generos, tiempos] =
      await Promise.all([
        this.prisma.dimFuente.findMany(),
        this.prisma.dimCategoria.findMany(),
        this.prisma.dimMoneda.findMany(),
        this.prisma.dimCalificacion.findMany(),
        this.prisma.dimGenero.findMany(),
        this.prisma.dimTiempo.findMany(),
      ]);
    return {
      fuente: new Map(fuentes.map((f) => [f.nombre_fuente, f.id_fuente])),
      categoria: new Map(
        categorias.map((c) => [c.nombre_categoria, c.id_categoria]),
      ),
      moneda: new Map(monedas.map((m) => [m.codigo_moneda, m.id_moneda])),
      calificacion: new Map(
        calificaciones.map((c) => [c.nivel, c.id_calificacion]),
      ),
      genero: new Map(generos.map((g) => [g.nombre_genero, g.id_genero])),
      tiempo: new Map(
        tiempos.map((t) => [
          t.fecha_completa.toISOString().slice(0, 10),
          t.id_tiempo,
        ]),
      ),
    };
  }

  private async loadFactProductos(
    data: ProductRow[],
    dims: Awaited<ReturnType<DwLoaderService['loadDimLookups']>>,
  ): Promise<{
    inserted: number;
    skipped: number;
    loadedRecords: { offerId: string; sourceId: string }[];
  }> {
    this.logger.log(
      `Cargando FactProductos (${data.length} registros de staging)...`,
    );
    let inserted = 0;
    let skipped = 0;
    const loadedRecords: { offerId: string; sourceId: string }[] = [];
    for (const item of data) {
      const titulo = item['titulo_oferta'];
      if (typeof titulo !== 'string' || titulo === '') {
        skipped++;
        continue;
      }

      const dimProducto = await this.prisma.dimProducto.create({
        data: {
          titulo_oferta: titulo,
          url_producto:
            typeof item['url_producto'] === 'string'
              ? item['url_producto']
              : null,
          disponibilidad:
            typeof item['disponibilidad'] === 'string'
              ? item['disponibilidad']
              : null,
        },
      });

      // Normalize domain-based source codes: 'ec.shein.com' → 'shein', 'temu.com' → 'temu'
      const rawFuente = toSafeString(item['_fuente'], 'csv_dataset').toLowerCase();
      const nombreFuente = this.normalizeSourceName(rawFuente);
      const nombreCategoria = toSafeString(
        item['categoria_normalizada'] ?? item['_categoria'],
        'otros',
      ).toLowerCase();
      const codigoMoneda = toSafeString(item['moneda'], 'USD').toUpperCase();
      const fechaStr =
        typeof item['_extraido_en'] === 'string'
          ? item['_extraido_en'].slice(0, 10)
          : undefined;
      const nivelCalif =
        typeof item['calificacion'] === 'string' ? item['calificacion'] : null;

      const idFuente = dims.fuente.get(nombreFuente);
      const idCategoria = dims.categoria.get(nombreCategoria);
      const idTiempo = fechaStr ? dims.tiempo.get(fechaStr) : undefined;
      const idMoneda = dims.moneda.get(codigoMoneda);

      if (!idFuente || !idCategoria || !idTiempo || !idMoneda) {
        // Debug logging for skipped products
        this.logger.warn(
          `Skipping product due to missing dims: titulo=${String(titulo).slice(0, 30)}, ` +
          `idFuente=${idFuente}(wanted=${nombreFuente}), ` +
          `idCategoria=${idCategoria}(wanted=${nombreCategoria}), ` +
          `idTiempo=${idTiempo}(fecha=${fechaStr}), ` +
          `idMoneda=${idMoneda}(wanted=${codigoMoneda})`
        );
        skipped++;
        continue;
      }

      const idCalificacion = nivelCalif
        ? (dims.calificacion.get(nivelCalif) ?? null)
        : null;

      try {
        await this.prisma.factProducto.create({
          data: {
            id_producto: dimProducto.id_producto,
            id_fuente: idFuente,
            id_categoria: idCategoria,
            id_tiempo: idTiempo,
            id_moneda: idMoneda,
            id_calificacion: idCalificacion,
            precio_usd:
              typeof item['precio_usd'] === 'number'
                ? item['precio_usd']
                : null,
            precio_raw:
              item['precio_raw'] != null
                ? toSafeString(item['precio_raw'], '')
                : null,
            disponibilidad:
              typeof item['disponibilidad'] === 'string'
                ? item['disponibilidad']
                : null,
          },
        });
        inserted++;
        if (typeof item['_offerId'] === 'string' && typeof item['_sourceId'] === 'string') {
          loadedRecords.push({
            offerId: item['_offerId'],
            sourceId: item['_sourceId'],
          });
        }
      } catch (err) {
        this.logger.error(
          `  Error insertando hecho: ${(err as Error).message?.slice(0, 100)}`,
        );
        skipped++;
      }
    }
    this.logger.log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
    return { inserted, skipped, loadedRecords };
  }

  private async loadFactEncuesta(
    data: EncuestaRow[],
    dims: Awaited<ReturnType<DwLoaderService['loadDimLookups']>>,
  ): Promise<{ inserted: number; skipped: number }> {
    this.logger.log(
      `Cargando FactEncuestaConsumo (${data.length} registros de encuesta)...`,
    );
    let inserted = 0;
    let skipped = 0;
    for (const item of data) {
      const genero =
        typeof item['genero'] === 'string' ? item['genero'] : 'Masculino';
      const idGenero = dims.genero.get(genero);
      const sitioKey =
        typeof item['sitio_preferido'] === 'string'
          ? item['sitio_preferido']
          : '';
      const nombreSitio = SITIO_MAP[sitioKey] ?? 'csv_dataset';
      const idSitio = dims.fuente.get(nombreSitio);

      if (!idGenero || !idSitio) {
        skipped++;
        continue;
      }

      try {
        await this.prisma.factEncuestaConsumo.create({
          data: {
            id_genero: idGenero,
            id_sitio_preferido: idSitio,
            edad:
              typeof item['edad'] === 'string' ||
              typeof item['edad'] === 'number'
                ? parseInt(String(item['edad']), 10)
                : null,
            frecuencia_compra:
              typeof item['frecuencia_compra'] === 'string'
                ? item['frecuencia_compra']
                : null,
            gasto_promedio_mensual:
              typeof item['gasto_promedio_mensual'] === 'string'
                ? item['gasto_promedio_mensual']
                : null,
            motivo_compra:
              typeof item['motivo_compra'] === 'string'
                ? item['motivo_compra']
                : null,
          },
        });
        inserted++;
      } catch (err) {
        this.logger.error(
          `  Error insertando encuesta: ${(err as Error).message?.slice(0, 100)}`,
        );
        skipped++;
      }
    }
    this.logger.log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
    return { inserted, skipped };
  }
}

/* eslint-disable @typescript-eslint/no-unnecessary-condition */
if (require.main === module) {
  const configService = new ConfigService();
  const prisma = new AnalyticsPrismaService();
  const operationalPrisma = new OperationalPrismaService();
  const truncateFirst = process.argv.includes('--truncate');
  new DwLoaderService(prisma, configService, new QualityService(), operationalPrisma)
    .load({ truncateFirst })
    .then(async (result) => {
      console.log(
        `dw-load: productos=${result.productosCargados} encuestas=${result.encuestasCargadas} estado=${result.estado}`,
      );
      await prisma.$disconnect();
      await operationalPrisma.$disconnect();
      process.exit(result.estado === 'completado' ? 0 : 1);
    })
    .catch(async (err: unknown) => {
      console.error('dw-load: fatal', err);
      await prisma.$disconnect();
      await operationalPrisma.$disconnect();
      process.exit(1);
    });
}
/* eslint-enable @typescript-eslint/no-unnecessary-condition */
