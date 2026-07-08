/**
 * Pipeline barrel — re-exports every pipeline interface, type, and DI token.
 *
 * Import patterns:
 *   import { IDwLoader, PipelineSource, DW_LOADER } from '@web-scraping/contracts/pipeline';
 *   import type { ScrapeResult, LoadResult } from '@web-scraping/contracts/pipeline';
 */
export { PipelineSource } from './pipeline.source.js';
export type {
  SourceConfig,
  ScrapeResult,
  LoadResult,
  PipelineRunSummary,
  StagingOptions,
  StagingResult,
} from './pipeline.types.js';
export type { IDwLoader, IDataSource, IStagingProcessor } from './pipeline.ports.js';
export { DW_LOADER, DATA_SOURCES, STAGING_PROCESSOR } from './pipeline.token.js';
