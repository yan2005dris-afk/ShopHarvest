/**
 * Re-exports the pipeline contract surface from
 * `@web-scraping/contracts/pipeline` so the rest of this module can
 * import from a single canonical import path. The point of the indirection:
 *
 *   1. The NestJS pipeline module is a thin shell: every port, type, and
 *      DI token it needs lives in the contracts package so adapters and
 *      consumers stay aligned with the canonical interface.
 *   2. If the contracts package ever exposes analytics + pipeline under
 *      a future single namespace, the consolidation lands in ONE place.
 */
export {
  PipelineSource,
  DW_LOADER,
  DATA_SOURCES,
  STAGING_PROCESSOR,
} from '@web-scraping/contracts/pipeline';

export type {
  IDwLoader,
  IDataSource,
  IStagingProcessor,
  LoadResult,
  ScrapeResult,
  SourceConfig,
  StagingOptions,
  StagingResult,
  PipelineRunSummary,
} from '@web-scraping/contracts/pipeline';
