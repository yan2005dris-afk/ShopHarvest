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
export type { BrowserFactoryOptions } from './browser-factory-options.js';
export type { ScraperMetrics, EtlRunState } from './scraper-metrics.js';
export type { SourceMechanism } from './source-mechanism.js';
export { SOURCE_MECHANISM_MAP } from './source-mechanism.js';
export type { ExtensionExport, ExtensionExportProduct } from './extension-export.js';
export { validateExtensionExport } from './extension-export.js';
export { BadExtensionExportError } from './bad-extension-export.error.js';
export type { EtlRunStatus, EtlRunDto, EtlRunListResponseDto, EtlRunFiltersDto, TriggerEtlRequestDto, TriggerEtlResponseDto } from './etl-run.dto.js';
