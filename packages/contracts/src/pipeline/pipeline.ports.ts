/**
 * Ports — the contract surface for the pipeline's hexagonal architecture.
 *
 * Each interface is the inbound boundary the NestJS module depends on;
 * concrete adapters (NestJS @Injectable classes under
 * `backend/src/modules/pipeline/adapters/`) implement them. The legacy
 * CLI scripts under `backend/pipeline/scripts/` are pure functions called
 * BY the adapters — they do NOT implement these interfaces directly
 * because they're framework-free plain functions, not Nest providers.
 *
 * That split (interface lives in contracts; script is plain TS; adapter
 * is Nest provider that wires the two) is what makes the same script
 * reusable from `npx ts-node` AND from `nest start`.
 */
import type { LoadResult, ScrapeResult, SourceConfig, StagingOptions, StagingResult } from './pipeline.types.js';
import type { PipelineSource } from './pipeline.source.js';

/**
 * Loads clean staging JSON into the `dw.*` schema. The `truncateFirst`
 * flag is the idempotency lever: when true, fact tables AND
 * `dw.dim_producto` are TRUNCATE CASCADE so the next load starts from
 * a known-empty state. When false, ON CONFLICT DO NOTHING on dimensions
 * keeps the existing rows in place.
 */
export interface IDwLoader {
  load(opts?: {
    truncateFirst?: boolean;
    inMemoryData?: {
      productos?: Record<string, unknown>[];
      encuestas?: Record<string, unknown>[];
    };
  }): Promise<LoadResult>;
}

/**
 * Each external data source declares its own adapter implementing
 * `IDataSource`. `source` is the canonical enum value — the DI
 * container groups all adapters under `DATA_SOURCES` so the orchestrator
 * can look them up by source.
 */
export interface IDataSource {
  readonly source: PipelineSource;
  run(config: SourceConfig): Promise<ScrapeResult>;
}

/**
 * Processes raw JSON dumps into the cleaned staging layer that the
 * DW loader consumes. Output goes to `backend/pipeline/staging/`.
 */
export interface IStagingProcessor {
  run(opts?: StagingOptions): Promise<StagingResult>;
}
