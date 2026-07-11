/**
 * Analytics barrel — re-exports every analytics DTO.
 *
 * Import patterns:
 *   import { AllKpisResponseDto, KpiPrecioCategoriaDto } from '@web-scraping/contracts/analytics';
 *   import { LoadDwDto } from '@web-scraping/contracts/analytics';
 *   import type { TimeSeriesByQuarterResponseDto } from '@web-scraping/contracts/analytics';
 */
export {
  KpiPrecioCategoriaDto,
  KpiDistribucionFuentesDto,
  KpiCompletitudDto,
  KpiRangoPreciosDto,
  KpiPreferenciaDto,
  AllKpisResponseDto,
} from './kpi.dto.js';

export {
  PreguntaPrincipalRowDto,
  RankedProductRowDto,
  CategoryDistributionRowDto,
  PercentileRowDto,
  OutlierRowDto,
  EncuestaRowDto,
  DwSummaryRowDto,
  DwSnapshotDto,
  DwSummaryResponseDto,
} from './query.dto.js';

export { LoadDwDto } from './load-dw.dto.js';

export {
  TimeSeriesRowDto,
  TimeSeriesByQuarterResponseDto,
} from './time-series.dto.js';