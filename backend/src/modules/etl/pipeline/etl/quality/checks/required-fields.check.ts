import type { QualityCheckResult } from '../quality-check.types';

const REQUIRED_FIELDS = ['titulo_oferta', 'url_producto', '_fuente'] as const;

/** Check 1: every staging row has non-empty title, url, and source. */
export function requiredFieldsCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const failures: string[] = [];
  rows.forEach((row, i) => {
    for (const field of REQUIRED_FIELDS) {
      const value = row[field];
      if (value == null || value === '') {
        failures.push(`row[${i}]: missing ${field}`);
      }
    }
  });
  return { passed: failures.length === 0, failures };
}
