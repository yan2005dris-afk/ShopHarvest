import type { QualityCheckResult } from '../quality-check.types';
import { MONEDAS } from '../../etl.constants';

const KNOWN_CODES = new Set(MONEDAS.map((m) => m.codigo));

/** Check 3: `moneda` is one of the seeded `dim_moneda` currency codes. */
export function currencyKnownCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const failures: string[] = [];
  rows.forEach((row, i) => {
    const moneda = row['moneda'];
    // Fail closed: a missing currency cannot be converted to USD and must not
    // silently pass the gate (previously `moneda == null` returned early).
    if (typeof moneda !== 'string' || !KNOWN_CODES.has(moneda.toUpperCase())) {
      failures.push(
        `row[${i}]: unknown currency code ${JSON.stringify(moneda)}`,
      );
    }
  });
  return { passed: failures.length === 0, failures };
}
