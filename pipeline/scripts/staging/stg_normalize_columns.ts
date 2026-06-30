// Homologa nombres de campos entre las 4 fuentes hacia un esquema canónico único
export const COLUMN_MAP: Record<string, string> = {
  // Títulos
  title:          'titulo_oferta',
  product_title:  'titulo_oferta',
  nombre:         'titulo_oferta',
  name:           'titulo_oferta',
  titulo:         'titulo_oferta',
  // Precio
  price:          'precio_raw',
  sale_price:     'precio_raw',
  precio:         'precio_raw',
  // Moneda
  currency:       'moneda',
  moneda:         'moneda',
  // Categoría
  category:       'categoria',
  categoria:      'categoria',
  // URL
  link:           'url_producto',
  url:            'url_producto',
  url_producto:   'url_producto',
  // Rating
  rating:         'calificacion',
  // Ventas
  ventas:         'ventas',
  sold:           'ventas',
};

export function normalizeColumns(record: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    result[COLUMN_MAP[key] ?? key] = value;
  }
  return result;
}
