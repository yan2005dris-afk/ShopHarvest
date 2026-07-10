import type { PipelineSource } from "./pipeline.source.js";

/**
 * Run-level state for a scraper. Wire vocabulary is 4-valued; the
 * public.EtlRunStatus Prisma enum is 3-valued (no QUEUED). The mapping
 * happens at the persistence layer (PR 6 dw-loader.service.ts):
 *   'queued'  → (no DB row yet, run is being prepared)
 *   'running' → EtlRunStatus.RUNNING
 *   'success' → EtlRunStatus.SUCCESS
 *   'failed'  → EtlRunStatus.FAILED
 */
export type EtlRunState = "queued" | "running" | "success" | "failed";

/**
 * Metrics emitted by a scraper for observability. Used by the pipeline
 * service to populate `EtlRun.rowsScraped`, `EtlRun.finishedAt`, and
 * `EtlRun.errorSummary` in PR 6.
 *
 * Currently optional in the IDataSource contract (the adapter may
 * just log the metrics without surfacing them in the return value).
 */
export interface ScraperMetrics {
	source: PipelineSource;
	itemsExtracted: number;
	durationMs: number;
	/** Number of retry attempts (0 = first try succeeded, 1 = one retry, ...). */
	retries: number;
	state: EtlRunState;
	/** ISO-8601 timestamp of when the scrape started. */
	startedAt: string;
	/** ISO-8601 timestamp of when the scrape finished (success or fail). */
	finishedAt: string;
	errors: string[];
}
