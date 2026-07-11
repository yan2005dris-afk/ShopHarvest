import type { QualityCheckResult } from '../quality-check.types';

/** Check 5: `categoria_normalizada` is present and non-empty. */
export function categoryNonemptyCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const failures: string[] = [];
  rows.forEach((row, i) => {
    const categoria = row['categoria_normalizada'];
    if (typeof categoria !== 'string' || categoria.trim() === '') {
      failures.push(`row[${i}]: missing categoria_normalizada`);
    }
  });
  return { passed: failures.length === 0, failures };
}
