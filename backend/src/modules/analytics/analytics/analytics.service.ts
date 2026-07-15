import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AnalyticsPrismaService } from '../../../common/prisma/analytics-prisma.service';
import {
  AllKpisResponseDto,
  KpiPrecioCategoriaDto,
  KpiDistribucionFuentesDto,
  KpiCompletitudDto,
  KpiRangoPreciosDto,
  KpiPreferenciaDto,
} from '@web-scraping/contracts/analytics';
import { serializeKpiRow, serializeKpiRows } from './dto/serializers';

/**
 * AnalyticsService — KPI card endpoints backed by `dw.v_kpi_*` views.
 *
 * Reads only — no mutations. Every method calls `prisma.$queryRawUnsafe`
 * with the verbatim SQL from `backend/pipeline/scripts/dw/dw_analytical_queries.sql`
 * (cast `::numeric` already applied in commit 92541d3).
 *
 * Two surfaces:
 *   - `getAllKpis()`  → one round trip, fan-out with Promise.all, used
 *     by the dashboard summary page.
 *   - `getKpi(name)`  → per-KPI drill-down. Whitelisted names keep the
 *     surface injectable for the URL params validated by NestJS.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  /** Whitelist of KPI names accepted on `GET /api/analytics/kpis/:name`. */
  static readonly KPI_NAMES = [
    'precio-categoria',
    'distribucion-fuentes',
    'completitud',
    'rango-precios',
    'preferencia',
  ] as const;

  /** Map KPI name → SQL statement. Centralized to avoid string drift. */
  private static readonly KPI_SQL: Record<
    (typeof AnalyticsService.KPI_NAMES)[number],
    string
  > = {
    'precio-categoria': 'SELECT * FROM dw.v_kpi_precio_promedio_categoria',
    'distribucion-fuentes': 'SELECT * FROM dw.v_kpi_distribucion_fuentes',
    completitud: 'SELECT * FROM dw.v_kpi_completitud_datos',
    'rango-precios': 'SELECT * FROM dw.v_kpi_rango_precios_fuente',
    preferencia: 'SELECT * FROM dw.v_kpi_preferencia_plataformas',
  };

  constructor(private readonly prisma: AnalyticsPrismaService) {}

  /**
   * Run all five KPI views in parallel and assemble the aggregated
   * envelope used by the dashboard summary page.
   *
   * `Promise.all` is intentional: the views are independent, so a single
   * HTTP call costs 5×round-trip time, not 5×round-trip + sequential.
   * If any view fails, the whole promise rejects and the HttpExceptionFilter
   * renders the standard RFC 7807 envelope — we never return a partial
   * dashboard.
   */
  async getAllKpis(): Promise<AllKpisResponseDto> {
    const [
      precioCategoria,
      distribucionFuentes,
      completitud,
      rangoPrecios,
      preferencia,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<KpiPrecioCategoriaDto[]>(
        AnalyticsService.KPI_SQL['precio-categoria'],
      ),
      this.prisma.$queryRawUnsafe<KpiDistribucionFuentesDto[]>(
        AnalyticsService.KPI_SQL['distribucion-fuentes'],
      ),
      this.prisma.$queryRawUnsafe<KpiCompletitudDto[]>(
        AnalyticsService.KPI_SQL['completitud'],
      ),
      this.prisma.$queryRawUnsafe<KpiRangoPreciosDto[]>(
        AnalyticsService.KPI_SQL['rango-precios'],
      ),
      this.prisma.$queryRawUnsafe<KpiPreferenciaDto[]>(
        AnalyticsService.KPI_SQL['preferencia'],
      ),
    ]);

    return {
      precio_categoria: serializeKpiRows(precioCategoria),
      distribucion_fuentes: serializeKpiRows(distribucionFuentes),
      completitud: serializeKpiRows(completitud),
      rango_precios: serializeKpiRows(rangoPrecios),
      preferencia: serializeKpiRows(preferencia),
    };
  }

  /**
   * Return one KPI by URL slug. Throws `NotFoundException` for any
   * value not on the whitelist — the controller validates path params
   * with NestJS, but this guard catches drift if someone bypasses the
   * controller (e.g. calls the service directly from another module).
   */
  async getKpi(name: string): Promise<unknown[]> {
    const sql =
      AnalyticsService.KPI_SQL[name as keyof typeof AnalyticsService.KPI_SQL];
    if (!sql) {
      throw new NotFoundException(
        `Unknown KPI "${name}". Valid names: ${AnalyticsService.KPI_NAMES.join(', ')}`,
      );
    }
    const rows =
      await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    return serializeKpiRows(rows);
  }

  /**
   * Run the "snapshot" banner SQL used by the summary and time-series
   * endpoints so the UI can render the date-range hint the PLAN §4.3
   * calls for.
   */
  async getSnapshot(): Promise<{
    fecha_min: string | null;
    fecha_max: string | null;
    fechas_distintas: number;
  }> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        fecha_min: Date | null;
        fecha_max: Date | null;
        fechas_distintas: bigint;
      }>
    >(
      'SELECT MIN(fecha_completa) AS fecha_min, MAX(fecha_completa) AS fecha_max, ' +
        'COUNT(*) AS fechas_distintas FROM dw.dim_tiempo',
    );
    const row = rows[0] ?? {
      fecha_min: null,
      fecha_max: null,
      fechas_distintas: 0n,
    };
    return serializeKpiRow({
      fecha_min:
        row.fecha_min instanceof Date
          ? row.fecha_min.toISOString().slice(0, 10)
          : null,
      fecha_max:
        row.fecha_max instanceof Date
          ? row.fecha_max.toISOString().slice(0, 10)
          : null,
      fechas_distintas: Number(row.fechas_distintas ?? 0),
    });
  }

  /**
   * Return per-table counts for the dashboard summary banner.
   * 9 tables (7 dim + 2 fact) in a single round-trip via UNION ALL.
   */
  async getDwCounts(): Promise<Array<{ tabla: string; registros: number }>> {
    const sql = `
      SELECT 'dim_producto' AS tabla, COUNT(*) AS registros FROM dw.dim_producto
      UNION ALL SELECT 'dim_fuente', COUNT(*) FROM dw.dim_fuente
      UNION ALL SELECT 'dim_categoria', COUNT(*) FROM dw.dim_categoria
      UNION ALL SELECT 'dim_tiempo', COUNT(*) FROM dw.dim_tiempo
      UNION ALL SELECT 'dim_moneda', COUNT(*) FROM dw.dim_moneda
      UNION ALL SELECT 'dim_calificacion', COUNT(*) FROM dw.dim_calificacion
      UNION ALL SELECT 'fact_productos', COUNT(*) FROM dw.fact_productos
      UNION ALL SELECT 'dim_genero', COUNT(*) FROM dw.dim_genero
      UNION ALL SELECT 'fact_encuesta_consumo', COUNT(*) FROM dw.fact_encuesta_consumo
      ORDER BY tabla
    `;
    const rows =
      await this.prisma.$queryRawUnsafe<
        Array<{ tabla: string; registros: bigint }>
      >(sql);
    return rows.map((r) => ({
      tabla: r.tabla,
      registros: Number(r.registros ?? 0n),
    }));
  }
}
