import type { QualityCheckResult } from '../quality-check.types';

/**
 * Check: no staging row was converted with a missing FX rate.
 * `_rate_missing` is set by `transformProduct` when `cleanAndConvertToUsd`
 * had a known currency but no matching rate, so `precio_usd` is null. That
 * must fail the run instead of silently passing (previously only logged).
 */
export function rateKnownCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const failures: string[] = [];
  rows.forEach((row, i) => {
    if (row['_rate_missing'] === true) {
      failures.push(
        `row[${i}]: missing FX rate for currency ${JSON.stringify(row['moneda'])}`,
      );
    }
  });
  return { passed: failures.length === 0, failures };
}
