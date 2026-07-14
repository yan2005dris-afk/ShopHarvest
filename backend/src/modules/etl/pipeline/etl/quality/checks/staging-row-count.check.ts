import type { QualityCheckResult } from '../quality-check.types';

/** Check 7: the staging batch has at least one row. */
export function stagingRowCountCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  if (rows.length === 0) {
    return { passed: false, failures: ['staging batch is empty (0 rows)'] };
  }
  return { passed: true, failures: [] };
}
