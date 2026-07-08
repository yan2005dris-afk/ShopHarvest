import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Wire shape for the rows of the "pregunta principal" analytical query
 * (`backend/pipeline/scripts/dw/dw_analytical_queries.sql` §1.1).
 *
 * One row per (fuente, categoria) pair, ordered by precio_promedio_usd DESC.
 */
export class PreguntaPrincipalRowDto {
  @ApiProperty({ example: 'mercadolibre' })
  fuente!: string;

  @ApiProperty({ example: 'electronica' })
  categoria!: string;

  @ApiProperty({ type: Number, example: 21 })
  total_productos!: number;

  @ApiProperty({ type: Number, example: 79.99 })
  precio_promedio_usd!: number;

  @ApiProperty({ type: Number, example: 12.5 })
  precio_minimo_usd!: number;

  @ApiProperty({ type: Number, example: 199.99 })
  precio_maximo_usd!: number;

  @ApiProperty({ type: Number, example: 65.4 })
  mediana_precio_usd!: number;

  @ApiProperty({ type: Number, example: 32.1 })
  desviacion_estandar!: number;
}

/**
 * Wire shape for `dw` ranked-products query (E4 §1.2).
 * `tipo` discriminates "MÁS ECONÓMICO" / "MÁS COSTOSO" so the frontend can
 * pivot the table without re-grouping.
 */
export class RankedProductRowDto {
  @ApiProperty({ example: 'aliexpress' })
  fuente!: string;

  @ApiProperty({ example: 'Wireless Earbuds Pro' })
  producto!: string;

  @ApiProperty({ type: Number, example: 1.99 })
  precio_usd!: number;

  @ApiProperty({
    example: 'MÁS ECONÓMICO',
    description: 'Discriminator: MÁS ECONÓMICO | MÁS COSTOSO.',
  })
  tipo!: string;
}

/**
 * Wire shape for the category distribution / availability query (E4 §1.3 +
 * §1.2 combined). `pct_del_total` is the share over all products (0-100);
 * `rank_frecuencia` is the DENSE_RANK in DESC order of total_productos.
 */
export class CategoryDistributionRowDto {
  @ApiProperty({ example: 'otros' })
  categoria!: string;

  @ApiProperty({ type: Number, example: 148 })
  total_productos!: number;

  @ApiProperty({ type: Number, example: 88.1 })
  pct_del_total!: number;

  @ApiProperty({ type: Number, example: 38.42 })
  precio_promedio!: number;

  @ApiProperty({ type: Number, example: 1 })
  rank_frecuencia!: number;
}

/**
 * Wire shape for the percentile analysis (E4 §2.1).
 * Five percentiles (p25, p50 = median, p75, p90) plus mean and stddev per source.
 */
export class PercentileRowDto {
  @ApiProperty({ example: 'shein' })
  fuente!: string;

  @ApiProperty({ type: Number, example: 22 })
  total_con_precio!: number;

  @ApiProperty({ type: Number, example: 9.5 })
  percentil_25!: number;

  @ApiProperty({ type: Number, example: 18.4 })
  mediana!: number;

  @ApiProperty({ type: Number, example: 35.2 })
  percentil_75!: number;

  @ApiProperty({ type: Number, example: 62.0 })
  percentil_90!: number;

  @ApiProperty({ type: Number, example: 24.5 })
  media!: number;

  @ApiProperty({ type: Number, example: 18.3 })
  desviacion!: number;
}

/**
 * Wire shape for the IQR outlier detection (E4 §2.2).
 * `clasificacion` is one of: OUTLIER INFERIOR | OUTLIER SUPERIOR | NORMAL.
 */
export class OutlierRowDto {
  @ApiProperty({ example: 'Premium Headphones 5000' })
  producto!: string;

  @ApiProperty({ example: 'aliexpress' })
  fuente!: string;

  @ApiProperty({ type: Number, example: 499.99 })
  precio_usd!: number;

  @ApiProperty({
    example: 'OUTLIER SUPERIOR',
    description: 'OUTLIER INFERIOR | OUTLIER SUPERIOR | NORMAL.',
  })
  clasificacion!: string;
}

/**
 * Wire shape for the survey-by-gender query (E4 §1.4).
 * One row per (genero, sitio_preferido, frecuencia, gasto_promedio) tuple.
 */
export class EncuestaRowDto {
  @ApiProperty({ example: 'Femenino' })
  genero!: string;

  @ApiProperty({ example: 'mercadolibre' })
  sitio_preferido!: string;

  @ApiProperty({ type: Number, example: 5 })
  total_encuestados!: number;

  @ApiProperty({ example: 'Semanal' })
  frecuencia!: string;

  @ApiProperty({ example: '$50-$100' })
  gasto_promedio!: string;
}

/**
 * Aggregate response for the time-series-by-quarter endpoint
 * (`/api/analytics/queries/time-series`). See `time-series.dto.ts` for the
 * per-row shape and the snapshot envelope.
 *
 * `snapshot` reports the date range currently present in `dw.dim_tiempo`
 * so the dashboard can render the "snapshot 2026-06-30" banner the PLAN §4.3
 * calls for; without it, the chart would silently misrepresent continuous
 * time series when only a single date has been loaded.
 */
export class DwSummaryRowDto {
  @ApiProperty({ example: 'dim_producto' })
  tabla!: string;

  @ApiProperty({ type: Number, example: 164 })
  registros!: number;
}

/**
 * Wrap the snapshot banner alongside the per-table counts so the frontend
 * can render both in one HTTP round trip.
 */
export class DwSnapshotDto {
  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-06-30',
    nullable: true,
    description: 'MIN(fecha_completa) from dw.dim_tiempo.',
  })
  fecha_min!: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-06-30',
    nullable: true,
    description: 'MAX(fecha_completa) from dw.dim_tiempo.',
  })
  fecha_max!: string | null;

  @ApiProperty({
    type: Number,
    example: 1,
    description: 'Count of distinct dates in dw.dim_tiempo.',
  })
  fechas_distintas!: number;
}

/**
 * Aggregate response for `GET /api/analytics/summary`.
 *
 * `tablas` is the per-table row count for every fact+dim table that the
 * dashboard exposes; `snapshot` is the date-range metadata used by the
 * UI to render the "snapshot" banner (PLAN §4.3).
 */
export class DwSummaryResponseDto {
  @ApiProperty({ type: () => DwSummaryRowDto, isArray: true })
  tablas!: DwSummaryRowDto[];

  @ApiProperty({ type: () => DwSnapshotDto })
  @Type(() => DwSnapshotDto)
  snapshot!: DwSnapshotDto;
}

/**
 * Wrap used by `runPreguntaPrincipal`, `runRankedProducts`, etc. so each
 * endpoint returns a tagged array the controller can pipe directly to
 * the wire without an extra envelope on the frontend side.
 *
 * Most analytical queries already return a flat array — only the summary
 * needs an envelope. Consumers import the row types directly via:
 *   `import type { PreguntaPrincipalRowDto } from '@web-scraping/contracts/analytics'`.
 */