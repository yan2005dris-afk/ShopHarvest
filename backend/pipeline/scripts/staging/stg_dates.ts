// Convierte fechas de cualquier formato al estándar ANSI: YYYY-MM-DD
export function standardizeDates(
  record: Record<string, any>,
  dateCols: string[],
): Record<string, any> {
  for (const col of dateCols) {
    if (record[col] != null && record[col] !== '') {
      const parsed = new Date(record[col]);
      record[col] = isNaN(parsed.getTime())
        ? null
        : parsed.toISOString().split('T')[0];
    }
  }
  return record;
}
