import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsPrismaService } from '../../common/prisma/analytics-prisma.service';
import {
  PreguntaPrincipalRowDto,
  RankedProductRowDto,
  CategoryDistributionRowDto,
  PercentileRowDto,
  OutlierRowDto,
  EncuestaRowDto,
  TimeSeriesRowDto,
  TimeSeriesByQuarterResponseDto,
  DwSummaryResponseDto,
} from '@web-scraping/contracts/analytics';
import { serializeKpiRows } from './dto/serializers';
import { AnalyticsService } from './analytics.service';

/**
 * AnalyticsQueryService — analytical queries from
 * `backend/pipeline/scripts/dw/dw_analytical_queries.sql` §1–2 plus the
 * new `runTimeSeriesByQuarter()` and `runDwSummary()` endpoints.
 *
 * All SQL strings are kept VERBATIM from the validated file (cast
 * `::numeric` already applied in commit 92541d3). Do not edit them
 * without re-running the manual validation suite documented in E4 §4.
 *
 * Wire shape: every result passes through `serializeKpiRows` so the
 * controller can pipe the rows straight to JSON without ever seeing a
 * BigInt.
 */
@Injectable()
export class AnalyticsQueryService {
  private readonly logger = new Logger(AnalyticsQueryService.name);

  constructor(
    private readonly prisma: AnalyticsPrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // E4 §1.1 — Pregunta Principal: comportamiento de precios
  // ─────────────────────────────────────────────────────────────
  async runPreguntaPrincipal(): Promise<PreguntaPrincipalRowDto[]> {
    const sql = `
      SELECT
          df.nombre_fuente          AS fuente,
          dc.nombre_categoria       AS categoria,
          COUNT(fp.id_hecho)        AS total_productos,
          ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio_usd,
          ROUND(MIN(fp.precio_usd), 2)  AS precio_minimo_usd,
          ROUND(MAX(fp.precio_usd), 2)  AS precio_maximo_usd,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS mediana_precio_usd,
          ROUND(STDDEV(fp.precio_usd)::numeric, 2) AS desviacion_estandar
      FROM dw.fact_productos fp
      JOIN dw.dim_fuente df       ON fp.id_fuente = df.id_fuente
      JOIN dw.dim_categoria dc    ON fp.id_categoria = dc.id_categoria
      JOIN dw.dim_tiempo dt       ON fp.id_tiempo = dt.id_tiempo
      WHERE fp.precio_usd IS NOT NULL
      GROUP BY df.nombre_fuente, dc.nombre_categoria
      ORDER BY precio_promedio_usd DESC
    `;
    const rows = await this.prisma.$queryRawUnsafe<PreguntaPrincipalRowDto[]>(sql);
    return serializeKpiRows<PreguntaPrincipalRowDto>(
      rows as unknown as Record<string, unknown>[],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // E4 §1.2 — Ranked products (MÁS ECONÓMICO / MÁS COSTOSO)
  // ─────────────────────────────────────────────────────────────
  async runRankedProducts(): Promise<RankedProductRowDto[]> {
    const sql = `
      WITH ranked_products AS (
          SELECT
              df.nombre_fuente AS fuente,
              dp.titulo_oferta AS producto,
              fp.precio_usd,
              RANK() OVER (
                  PARTITION BY df.nombre_fuente
                  ORDER BY fp.precio_usd ASC NULLS LAST
              ) AS rank_economico,
              RANK() OVER (
                  PARTITION BY df.nombre_fuente
                  ORDER BY fp.precio_usd DESC NULLS LAST
              ) AS rank_costoso
          FROM dw.fact_productos fp
          JOIN dw.dim_producto dp ON fp.id_producto = dp.id_producto
          JOIN dw.dim_fuente df   ON fp.id_fuente = df.id_fuente
          WHERE fp.precio_usd IS NOT NULL
      )
      SELECT fuente, producto, precio_usd, 'MÁS ECONÓMICO' AS tipo
      FROM ranked_products
      WHERE rank_economico = 1

      UNION ALL

      SELECT fuente, producto, precio_usd, 'MÁS COSTOSO' AS tipo
      FROM ranked_products
      WHERE rank_costoso = 1

      ORDER BY fuente, tipo DESC
    `;
    const rows = await this.prisma.$queryRawUnsafe<RankedProductRowDto[]>(sql);
    return serializeKpiRows<RankedProductRowDto>(
      rows as unknown as Record<string, unknown>[],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // E4 §1.3 — Distribución por categoría (DENSE_RANK)
  // ─────────────────────────────────────────────────────────────
  async runCategoryDistribution(): Promise<CategoryDistributionRowDto[]> {
    const sql = `
      SELECT
          dc.nombre_categoria       AS categoria,
          COUNT(fp.id_hecho)        AS total_productos,
          ROUND(COUNT(fp.id_hecho) * 100.0 / SUM(COUNT(fp.id_hecho)) OVER(), 1) AS pct_del_total,
          ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio,
          DENSE_RANK() OVER (ORDER BY COUNT(fp.id_hecho) DESC) AS rank_frecuencia
      FROM dw.fact_productos fp
      JOIN dw.dim_categoria dc ON fp.id_categoria = dc.id_categoria
      GROUP BY dc.nombre_categoria
      ORDER BY total_productos DESC
    `;
    const rows = await this.prisma.$queryRawUnsafe<CategoryDistributionRowDto[]>(sql);
    return serializeKpiRows<CategoryDistributionRowDto>(
      rows as unknown as Record<string, unknown>[],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // E4 §2.1 — Percentiles de precios por fuente
  // ─────────────────────────────────────────────────────────────
  async runPercentileAnalysis(): Promise<PercentileRowDto[]> {
    const sql = `
      SELECT
          df.nombre_fuente AS fuente,
          COUNT(fp.precio_usd) AS total_con_precio,
          ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS percentil_25,
          ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS mediana,
          ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS percentil_75,
          ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS percentil_90,
          ROUND(AVG(fp.precio_usd)::numeric, 2) AS media,
          ROUND(STDDEV(fp.precio_usd)::numeric, 2) AS desviacion
      FROM dw.fact_productos fp
      JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
      WHERE fp.precio_usd IS NOT NULL
      GROUP BY df.nombre_fuente
      ORDER BY media DESC
    `;
    const rows = await this.prisma.$queryRawUnsafe<PercentileRowDto[]>(sql);
    return serializeKpiRows<PercentileRowDto>(
      rows as unknown as Record<string, unknown>[],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // E4 §2.2 — Detección de outliers (IQR)
  // ─────────────────────────────────────────────────────────────
  async runOutlierDetection(): Promise<OutlierRowDto[]> {
    const sql = `
      WITH stats AS (
          SELECT
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY precio_usd) AS q1,
              PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY precio_usd) AS q3
          FROM dw.fact_productos
          WHERE precio_usd IS NOT NULL
      )
      SELECT
          dp.titulo_oferta AS producto,
          df.nombre_fuente AS fuente,
          fp.precio_usd,
          CASE
              WHEN fp.precio_usd < (SELECT q1 - 1.5 * (q3 - q1) FROM stats)
                  THEN 'OUTLIER INFERIOR'
              WHEN fp.precio_usd > (SELECT q3 + 1.5 * (q3 - q1) FROM stats)
                  THEN 'OUTLIER SUPERIOR'
              ELSE 'NORMAL'
          END AS clasificacion
      FROM dw.fact_productos fp
      JOIN dw.dim_producto dp ON fp.id_producto = dp.id_producto
      JOIN dw.dim_fuente df   ON fp.id_fuente = df.id_fuente
      WHERE fp.precio_usd IS NOT NULL
      ORDER BY fp.precio_usd DESC
    `;
    const rows = await this.prisma.$queryRawUnsafe<OutlierRowDto[]>(sql);
    return serializeKpiRows<OutlierRowDto>(
      rows as unknown as Record<string, unknown>[],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // E4 §1.4 — Análisis de encuesta (género × sitio)
  // ─────────────────────────────────────────────────────────────
  async runEncuestaAnalysis(): Promise<EncuestaRowDto[]> {
    const sql = `
      SELECT
          dg.nombre_genero          AS genero,
          df.nombre_fuente          AS sitio_preferido,
          COUNT(fec.id_hecho)       AS total_encuestados,
          fec.frecuencia_compra     AS frecuencia,
          fec.gasto_promedio_mensual AS gasto_promedio
      FROM dw.fact_encuesta_consumo fec
      JOIN dw.dim_genero dg  ON fec.id_genero = dg.id_genero
      JOIN dw.dim_fuente df  ON fec.id_sitio_preferido = df.id_fuente
      GROUP BY dg.nombre_genero, df.nombre_fuente, fec.frecuencia_compra, fec.gasto_promedio_mensual
      ORDER BY total_encuestados DESC
    `;
    const rows = await this.prisma.$queryRawUnsafe<EncuestaRowDto[]>(sql);
    return serializeKpiRows<EncuestaRowDto>(
      rows as unknown as Record<string, unknown>[],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NEW — Time series by quarter using DimTiempo.anio/trimestre/nombre_mes
  //
  // Documents PLAN §4.3: the dashboard shows "precio promedio por trimestre
  // por fuente" with the snapshot banner explaining the single-date DW
  // limitation. The query groups by all four dim columns so future ETL
  // re-runs populate richer series without an API change.
  // ─────────────────────────────────────────────────────────────
  async runTimeSeriesByQuarter(): Promise<TimeSeriesByQuarterResponseDto> {
    const sql = `
      SELECT
        dt.anio, dt.trimestre, dt.nombre_mes,
        df.nombre_fuente AS fuente,
        COUNT(*) AS total,
        ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio,
        ROUND(MIN(fp.precio_usd)::numeric, 2) AS precio_min,
        ROUND(MAX(fp.precio_usd)::numeric, 2) AS precio_max
      FROM dw.fact_productos fp
      JOIN dw.dim_tiempo dt ON fp.id_tiempo = dt.id_tiempo
      JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
      WHERE fp.precio_usd IS NOT NULL
      GROUP BY dt.anio, dt.trimestre, dt.nombre_mes, df.nombre_fuente
      ORDER BY dt.anio, dt.trimestre, df.nombre_fuente
    `;
    const rows = await this.prisma.$queryRawUnsafe<TimeSeriesRowDto[]>(sql);
    const snapshot = await this.analyticsService.getSnapshot();
    return {
      series: serializeKpiRows<TimeSeriesRowDto>(
        rows as unknown as Record<string, unknown>[],
      ),
      snapshot,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Summary — counts per dim/fact table + snapshot banner
  // ─────────────────────────────────────────────────────────────
  async runDwSummary(): Promise<DwSummaryResponseDto> {
    const [tablas, snapshot] = await Promise.all([
      this.analyticsService.getDwCounts(),
      this.analyticsService.getSnapshot(),
    ]);
    return { tablas, snapshot };
  }

  // ─────────────────────────────────────────────────────────────
  // POST /api/analytics/refresh-mv
  //
  // `dw.mv_resumen_precios` is a MATERIALIZED VIEW populated by the E4
  // ETL but never auto-refreshed by the BI surface. This endpoint lets
  // the dashboard trigger a REFRESH MATERIALIZED VIEW CONCURRENTLY
  // without shelling out to psql. CONCURRENTLY requires the MV to have
  // a UNIQUE index — documented in E4 §3.
  // ─────────────────────────────────────────────────────────────
  async refreshMaterializedView(): Promise<{ refreshed: true; view: string; ms: number }> {
    const start = Date.now();
    // CONCURRENTLY is wrapped in a try/catch because if a previous
    // REFRESH left the MV in an inconsistent state, Postgres refuses the
    // concurrent variant and forces a non-concurrent refresh. We fall
    // back to the exclusive path so the operator is never stuck.
    try {
      await this.prisma.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_resumen_precios',
      );
    } catch (err) {
      this.logger.warn(
        `REFRESH CONCURRENTLY failed (${(err as Error).message?.slice(0, 200)}); falling back to exclusive refresh`,
      );
      await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW dw.mv_resumen_precios');
    }
    return { refreshed: true, view: 'dw.mv_resumen_precios', ms: Date.now() - start };
  }
}