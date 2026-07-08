import { ApiProperty } from '@nestjs/swagger';

/**
 * Wire shape for the rows of `dw.v_kpi_precio_promedio_categoria`.
 *
 * The view is grouped by category and returns:
 *   - total_productos: BIGINT  → coerced to number on the wire
 *   - precio_promedio_usd: NUMERIC(2dp) → coerced to number
 *   - precio_minimo / precio_maximo: NUMERIC(2dp) → coerced to number
 *   - display_kpi: VARCHAR(concat('$', avg)) → preserved as-is
 *
 * Coercion happens in the service layer (`serializers.ts`); the DTO
 * declares the wire types the frontend consumes (numbers, not Decimal
 * strings) so the Swagger schema matches what the client sees.
 */
export class KpiPrecioCategoriaDto {
  @ApiProperty({ example: 'electronica' })
  categoria!: string;

  @ApiProperty({ type: Number, example: 42 })
  total_productos!: number;

  @ApiProperty({ type: Number, example: 49.97 })
  precio_promedio_usd!: number;

  @ApiProperty({ type: Number, example: 1.5 })
  precio_minimo!: number;

  @ApiProperty({ type: Number, example: 199.99 })
  precio_maximo!: number;

  @ApiProperty({ example: '$49.97' })
  display_kpi!: string;
}

/**
 * Wire shape for the rows of `dw.v_kpi_distribucion_fuentes`.
 * `total_productos` is a count (BIGINT) and `pct_contribucion` is a NUMERIC.
 */
export class KpiDistribucionFuentesDto {
  @ApiProperty({ example: 'mercadolibre' })
  fuente!: string;

  @ApiProperty({ example: 'scraping' })
  tipo!: string;

  @ApiProperty({ type: Number, example: 58 })
  total_productos!: number;

  @ApiProperty({ type: Number, example: 33.1, description: 'Percentage 0-100.' })
  pct_contribucion!: number;
}

/**
 * Wire shape for the rows of `dw.v_kpi_completitud_datos`.
 * Single-row view: aggregates of the FactProductos table.
 */
export class KpiCompletitudDto {
  @ApiProperty({ example: 'Completitud general' })
  kpi!: string;

  @ApiProperty({ type: Number, example: 96.4 })
  pct_precio_completo!: number;

  @ApiProperty({ type: Number, example: 100 })
  pct_categoria_asignada!: number;

  @ApiProperty({ type: Number, example: 33.3 })
  pct_calificacion_presente!: number;

  @ApiProperty({ type: Number, example: 96.4 })
  pct_ficha_completa!: number;
}

/**
 * Wire shape for the rows of `dw.v_kpi_rango_precios_fuente`.
 * `n` is the count of products with non-null price in the source.
 */
export class KpiRangoPreciosDto {
  @ApiProperty({ example: 'aliexpress' })
  fuente!: string;

  @ApiProperty({ type: Number, example: 55 })
  n!: number;

  @ApiProperty({ type: Number, example: 1.99 })
  precio_min!: number;

  @ApiProperty({ type: Number, example: 499.99 })
  precio_max!: number;

  @ApiProperty({ type: Number, example: 498.0 })
  rango_total!: number;

  @ApiProperty({
    type: Number,
    example: 4.13,
    description: '(max - min) / avg; >1 means high volatility across the source.',
  })
  indice_diversidad_gama!: number;
}

/**
 * Wire shape for the rows of `dw.v_kpi_preferencia_plataformas`.
 * `votos` is the count of encuesta rows that prefer each platform.
 */
export class KpiPreferenciaDto {
  @ApiProperty({ example: 'mercadolibre' })
  plataforma!: string;

  @ApiProperty({ type: Number, example: 11 })
  votos!: number;

  @ApiProperty({ type: Number, example: 45.8 })
  pct_preferencia!: number;

  @ApiProperty({
    type: Number,
    example: 24.5,
    description: 'Mean age of respondents who prefer this platform.',
  })
  edad_promedio_usuario!: number;

  @ApiProperty({
    example: 'Semanal, Mensual',
    description:
      'Comma-separated DISTINCT purchase frequencies observed for this platform.',
  })
  frecuencias_asociadas!: string;
}

/**
 * Aggregated response for `GET /api/analytics/kpis`. Each key maps 1:1 to
 * one `dw.v_kpi_*` view, fetched in parallel by `AnalyticsService.getAllKpis`.
 *
 * The dashboard summary page consumes this single envelope to render all
 * five KPI cards in a single round trip. Per-KPI endpoints still exist for
 * individual drill-downs.
 */
export class AllKpisResponseDto {
  @ApiProperty({ type: () => KpiPrecioCategoriaDto, isArray: true })
  precio_categoria!: KpiPrecioCategoriaDto[];

  @ApiProperty({ type: () => KpiDistribucionFuentesDto, isArray: true })
  distribucion_fuentes!: KpiDistribucionFuentesDto[];

  @ApiProperty({ type: () => KpiCompletitudDto, isArray: true })
  completitud!: KpiCompletitudDto[];

  @ApiProperty({ type: () => KpiRangoPreciosDto, isArray: true })
  rango_precios!: KpiRangoPreciosDto[];

  @ApiProperty({ type: () => KpiPreferenciaDto, isArray: true })
  preferencia!: KpiPreferenciaDto[];
}