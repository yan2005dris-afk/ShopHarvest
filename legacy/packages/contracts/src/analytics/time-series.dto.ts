import { ApiProperty } from '@nestjs/swagger';

/**
 * Wire shape for one row of `GET /api/analytics/queries/time-series`.
 *
 * The query groups `dw.fact_productos` by (anio, trimestre, nombre_mes,
 * fuente) and emits AVG/MIN/MAX/COUNT of `precio_usd`. The frontend uses
 * this to render a multi-series line chart "precio promedio por trimestre
 * por fuente" with the snapshot banner from `DwSnapshotDto`.
 *
 * `anio`, `trimestre` and `mes` are the warehouse dimensions so the chart
 * can order the x-axis without re-parsing the human-readable mes label.
 *
 * NOTE: with the current DW (single ETL run, 1 date in `dim_tiempo`),
 * the result will collapse to one quarter. The PLAN §4.3 acknowledges
 * this as a snapshot limitation; the endpoint exposes the same
 * dimension columns the schema has so future ETL re-runs automatically
 * produce richer series without an API change.
 */
export class TimeSeriesRowDto {
  @ApiProperty({ type: Number, example: 2026 })
  anio!: number;

  @ApiProperty({
    type: Number,
    example: 2,
    description: 'Quarter (1-4) derived from `mes` in dw.dim_tiempo.',
  })
  trimestre!: number;

  @ApiProperty({ example: 'Junio' })
  nombre_mes!: string;

  @ApiProperty({ example: 'mercadolibre' })
  fuente!: string;

  @ApiProperty({ type: Number, example: 58 })
  total!: number;

  @ApiProperty({ type: Number, example: 49.97 })
  precio_promedio!: number;

  @ApiProperty({ type: Number, example: 1.5 })
  precio_min!: number;

  @ApiProperty({ type: Number, example: 199.99 })
  precio_max!: number;
}

/**
 * Aggregate response for `GET /api/analytics/queries/time-series`.
 *
 * `series` is the per-row breakdown; `snapshot` reports the actual date
 * range present in `dw.dim_tiempo` so the UI can render the "snapshot
 * 2026-06-30" banner the PLAN §4.3 mandates (without it the chart would
 * silently misrepresent continuous time series when only a single date
 * is loaded).
 */
export class TimeSeriesByQuarterResponseDto {
  @ApiProperty({ type: () => TimeSeriesRowDto, isArray: true })
  series!: TimeSeriesRowDto[];

  @ApiProperty({
    type: () => Object,
    description:
      'Mirror of DwSnapshotDto: { fecha_min, fecha_max, fechas_distintas } from dw.dim_tiempo.',
  })
  snapshot!: {
    fecha_min: string | null;
    fecha_max: string | null;
    fechas_distintas: number;
  };
}