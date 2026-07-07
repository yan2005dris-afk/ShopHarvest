/**
 * Worker observability — run-level metrics computed from the scraper result
 * and the run lifecycle. The values are persisted to existing EtlRun fields
 * (rowsScraped, rowsPersisted, errorSummary) and also exposed as a structured
 * object so the worker can log them as JSON.
 *
 * Kept as a pure function so the unit tests need zero mocks. The orchestration
 * in `jobs/run-pipeline.ts` calls this once per tick and writes the result.
 */

export interface MetricsInput {
  startedAt: Date;
  endedAt: Date;
  /** Raw products returned by the scraper (pre-persistence). */
  scrapedProducts: ReadonlyArray<unknown>;
  /** Number of products that the persistence layer accepted (transactional). */
  rowsPersisted: number;
  /** Optional error — when present the run is FAILED, otherwise SUCCESS. */
  error?: Error;
}

export interface RunMetrics {
  rowsScraped: number;
  rowsPersisted: number;
  durationMs: number;
  errorSummary: string | null;
}

/**
 * Compute run-level metrics from a finished (or failed) scrape.
 *
 * Rules:
 *   - rowsScraped = scrapedProducts.length (what came out of the scraper)
 *   - rowsPersisted = passed through (caller knows what the DB accepted)
 *   - durationMs = endedAt - startedAt, never negative
 *   - errorSummary = error.message when present, null otherwise
 */
export function computeRunMetrics(input: MetricsInput): RunMetrics {
  const durationMs = Math.max(0, input.endedAt.getTime() - input.startedAt.getTime());
  return {
    rowsScraped: input.scrapedProducts.length,
    rowsPersisted: input.rowsPersisted,
    durationMs,
    errorSummary: input.error ? input.error.message : null,
  };
}

/**
 * Build the QualityMetric payload that the persistence layer writes next
 * to each successful run. Currently this is a single completeness number
 * derived from rowsPersisted / rowsScraped (when both are 0 the run is
 * "no data" and we report 0% rather than NaN).
 *
 * Other 7 quality controls (per tasks.md → "Out of Scope v1") are NOT
 * computed here; the check map is empty until PR 3.
 */
export function buildQualityMetric(metrics: RunMetrics): {
  completenessPct: number;
  duplicatesRemoved: number;
  checks: Record<string, { passed: number; failed: number }>;
} {
  const completenessPct =
    metrics.rowsScraped > 0
      ? Math.round((metrics.rowsPersisted / metrics.rowsScraped) * 10000) / 100
      : 0;
  return {
    completenessPct,
    duplicatesRemoved: 0,
    checks: {},
  };
}
