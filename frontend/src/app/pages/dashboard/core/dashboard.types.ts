/**
 * Dashboard types — re-exports the wire DTOs from `@web-scraping/contracts`
 * so the dashboard pages and services can import them from one place.
 *
 * Keeping the dashboard's type surface mirrored from the shared
 * contracts package means:
 *   - The shape of every API response is owned by the backend DTO; the
 *     frontend never re-declares field names that could drift.
 *   - The `DwSummaryResponseDto`, `AllKpisResponseDto`, etc. types stay
 *     the single source of truth across components.
 *
 * Local aliases are intentionally narrow so that the dashboard code
 * can shorten verbose DTO names where the call-site makes the source
 * obvious (e.g. `Summary = DwSummaryResponseDto`).
 */
import type {
  AllKpisResponseDto,
  CategoryDistributionRowDto,
  DwSummaryResponseDto,
  EncuestaRowDto,
  OutlierRowDto,
  PercentileRowDto,
  PreguntaPrincipalRowDto,
  RankedProductRowDto,
  TimeSeriesByQuarterResponseDto,
  TimeSeriesRowDto,
} from '@web-scraping/contracts/analytics';

/** Aggregated KPI envelope — used by /api/analytics/kpis */
export type AllKpis = AllKpisResponseDto;

/** DW summary with snapshot banner — used by /api/analytics/summary */
export type Summary = DwSummaryResponseDto;

/** Pregunta principal — precios por fuente × categoría */
export type PreguntaPrincipalRow = PreguntaPrincipalRowDto;

/** Ranked products — más económico + más costoso por fuente */
export type RankedProductRow = RankedProductRowDto;

/** Category distribution — dense rank por categoría */
export type CategoryDistributionRow = CategoryDistributionRowDto;

/** Percentiles por fuente (p25/p50/p75/p90/media/desv) */
export type PercentileRow = PercentileRowDto;

/** Outliers IQR por producto */
export type OutlierRow = OutlierRowDto;

/** Encuesta — género × sitio × frecuencia × gasto */
export type EncuestaRow = EncuestaRowDto;

/** Time-series quarterly row */
export type TimeSeriesRow = TimeSeriesRowDto;

/** Time-series response with snapshot banner */
export type TimeSeriesResponse = TimeSeriesByQuarterResponseDto;

/**
 * Domain enums kept locally because they are presentation-layer
 * concerns that the backend does not own.
 */
export type Fuente = string;
export type Categoria = string;

/**
 * Lookup table used by the filters sidebar to drive the multi-selects.
 * The dashboard populates this from the union of categories / sources
 * present in the response payloads; it is not part of the wire
 * contract on purpose.
 */
export type FilterOption = { value: string; label: string };