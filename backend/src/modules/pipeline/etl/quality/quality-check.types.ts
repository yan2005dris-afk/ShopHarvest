export interface QualityCheckResult {
  passed: boolean;
  failures: string[];
}

export type QualityCheckFn = (
  rows: ReadonlyArray<Record<string, unknown>>,
) => QualityCheckResult;

export interface QualityCheckOutcome extends QualityCheckResult {
  name: string;
}

/**
 * Aggregate result of running all 7 quality checks against one staging
 * batch (ETL-3, ETL-4). `state === 'failed'` means at least one check
 * failed — the DW loader MUST NOT run for that batch.
 */
export interface QualityReport {
  state: 'passed' | 'failed';
  checks: QualityCheckOutcome[];
}
