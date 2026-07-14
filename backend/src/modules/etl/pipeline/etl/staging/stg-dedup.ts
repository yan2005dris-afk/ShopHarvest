/**
 * Deduplica registros por una clave compuesta de columnas.
 * Ported 1:1 from legacy `stg_dedup.ts`.
 */
/** Safely stringify an unknown cell value for composite-key building. */
function keyPart(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.toLowerCase().trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function deduplicate(
  records: Record<string, unknown>[],
  keyCols: readonly string[],
): { data: Record<string, unknown>[]; removed: number } {
  const seen = new Set<string>();
  const data = records.filter((r) => {
    const key = keyCols.map((c) => keyPart(r[c])).join('||');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { data, removed: records.length - data.length };
}
