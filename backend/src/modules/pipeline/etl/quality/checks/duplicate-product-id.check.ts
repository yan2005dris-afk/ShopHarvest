import type { QualityCheckResult } from '../quality-check.types';

const KEY_COLS = ['titulo_oferta', 'precio_raw', '_fuente'] as const;

/** Safely stringify an unknown cell value for composite-key building. */
function keyPart(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.toLowerCase().trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Check 6: no duplicate product identity (`titulo_oferta` + `precio_raw`
 * + `_fuente`, the same composite key `stg_dedup` uses) within the batch.
 * The staging processor already deduplicates before this check runs —
 * this is a defense-in-depth verification, not the primary dedup pass.
 */
export function duplicateProductIdCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const seen = new Map<string, number>();
  const failures: string[] = [];
  rows.forEach((row, i) => {
    const key = KEY_COLS.map((c) => keyPart(row[c])).join('||');
    const firstIndex = seen.get(key);
    if (firstIndex !== undefined) {
      failures.push(
        `row[${i}]: duplicate of row[${firstIndex}] (key="${key}")`,
      );
    } else {
      seen.set(key, i);
    }
  });
  return { passed: failures.length === 0, failures };
}
