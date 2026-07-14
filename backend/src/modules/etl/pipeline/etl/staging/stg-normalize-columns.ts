/**
 * Homologa nombres de campo entre las distintas fuentes hacia un
 * esquema canónico único. Ported 1:1 from legacy `stg_normalize_columns.ts`.
 */
export const COLUMN_MAP: Readonly<Record<string, string>> = {
  title: 'titulo_oferta',
  product_title: 'titulo_oferta',
  nombre: 'titulo_oferta',
  name: 'titulo_oferta',
  titulo: 'titulo_oferta',
  price: 'precio_raw',
  sale_price: 'precio_raw',
  precio: 'precio_raw',
  currency: 'moneda',
  moneda: 'moneda',
  category: 'categoria',
  categoria: 'categoria',
  link: 'url_producto',
  url: 'url_producto',
  url_producto: 'url_producto',
  rating: 'calificacion',
  ventas: 'ventas',
  sold: 'ventas',
};

export function normalizeColumns(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[COLUMN_MAP[key] ?? key] = value;
  }
  return result;
}
