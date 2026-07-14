import type { QualityCheckResult } from '../quality-check.types';

/** Check 2: `precio_usd` is either absent (null) or strictly positive. */
export function pricePositiveCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const failures: string[] = [];
  rows.forEach((row, i) => {
    const precio = row['precio_usd'];
    if (precio == null) return;
    if (typeof precio !== 'number' || Number.isNaN(precio) || precio <= 0) {
      failures.push(
        `row[${i}]: precio_usd is not a positive number (${JSON.stringify(precio)})`,
      );
    }
  });
  return { passed: failures.length === 0, failures };
}
