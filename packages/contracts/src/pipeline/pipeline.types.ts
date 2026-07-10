/**
 * Pipeline DTOs shared between the NestJS module and the pure-function
 * scrapers under `backend/pipeline/scripts/`. These types live in
 * `@web-scraping/contracts/pipeline` so the legacy scripts (which can
 * still be invoked via `npx ts-node`) and the new module share one
 * vocabulary for inputs/outputs.
 *
 * Naming convention: camelCase. The analytics controller's HTTP response
 * (which uses snake_case) is mapped at the controller boundary; pipeline
 * internals stay idiomatic TS.
 */
import type { PipelineSource } from './pipeline.source.js';
import type { ScraperMetrics } from './scraper-metrics.js';

/**
 * Input for `IDataSource.run`. The scraper is told where to write the
 * raw JSON dump (`outputDir`) and may receive extra knobs (`extra`) that
 * are source-specific (e.g. MercadoLibre accept-language headers, AliExpress
 * max pages, etc.).
 */
export interface SourceConfig {
  source: PipelineSource;
  /** Absolute or backend-relative path where the scraper should drop raw JSON. */
  outputDir: string;
  /** Hard cap on records returned. Scraper may return fewer. */
  maxItems?: number;
  /** Source-specific knobs. Defined per adapter (NOT a free-form Record<string, any> here to keep the boundary tight). */
  extra?: Record<string, unknown>;
}

/**
 * Output for `IDataSource.run`. `errors` is non-fatal — the scraper
 * captured them in the run log but kept going. `outputPath` lets the
 * caller wire the next stage (staging → DW).
 */
export interface ScrapeResult {
  source: PipelineSource;
  totalScraped: number;
  /** Absolute path to the JSON dump on disk. */
  outputPath: string;
  durationMs: number;
  errors: string[];
  /**
   * Observability payload (items, retries, run state, timestamps).
   * Optional so adapters that haven't adopted `ScraperMetrics` yet
   * (Ali/Temu/Shein/CSV/Encuesta/API-rates, pending their own PRs)
   * keep compiling. PR 6's persistence layer reads this when present.
   */
  metrics?: ScraperMetrics;
}

/**
 * Output for `IDwLoader.load`. `estado === 'fallido'` signals an
 * unrecoverable failure; the caller can surface `error` to the UI as
 * a toast. Counts are partial best-effort when the run fails mid-way.
 */
export interface LoadResult {
  productosCargados: number;
  encuestasCargadas: number;
  tiempoMs: number;
  estado: 'completado' | 'fallido';
  error?: string;
}

/**
 * Output for `PipelineService.runAll`. Aggregates everything a single
 * orchestrator pass produced.
 */
export interface PipelineRunSummary {
  scrapeResults: ScrapeResult[];
  stagingResult?: {
    totalProductos: number;
    totalEncuestas: number;
    durationMs: number;
  };
  loadResult?: LoadResult;
  totalDurationMs: number;
}

/**
 * Options for `IStagingProcessor.run`. `inputDir` defaults to the
 * conventional raw/ tree (`backend/pipeline/raw/`); `outputDir` defaults
 * to `backend/pipeline/staging/`. Both can be overridden for unit tests.
 */
export interface StagingOptions {
  inputDir?: string;
  outputDir?: string;
}

export interface StagingResult {
  totalProductos: number;
  totalEncuestas: number;
  durationMs: number;
}
