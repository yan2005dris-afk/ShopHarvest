/**
 * Convierte fechas de cualquier formato al estándar ANSI: YYYY-MM-DD.
 * Ported 1:1 from legacy `stg_dates.ts`.
 */
export function standardizeDates(
  record: Record<string, unknown>,
  dateCols: readonly string[],
): Record<string, unknown> {
  for (const col of dateCols) {
    const value = record[col];
    if (value != null && value !== '') {
      const parsed = new Date(value as string | number);
      record[col] = Number.isNaN(parsed.getTime())
        ? null
        : parsed.toISOString().split('T')[0];
    }
  }
  return record;
}
