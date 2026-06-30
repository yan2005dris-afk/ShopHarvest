// Deduplica registros por una clave compuesta de columnas
export function deduplicate<T extends Record<string, any>>(
  records: T[],
  keyCols: (keyof T)[],
): { data: T[]; removed: number } {
  const seen = new Set<string>();

  const data = records.filter(r => {
    const key = keyCols.map(c => String(r[c] ?? '').toLowerCase().trim()).join('||');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { data, removed: records.length - data.length };
}
