/**
 * The preset canonical roles the app understands for a scraped product.
 * `aliases` lists the raw extracted keys that count as an exact-name
 * auto-match (see `extractAllFromContainer` in the extension, which
 * writes both a Spanish key like `titulo` and an English alias like
 * `title` on every product) — used to seed a sensible default source
 * for each canonical field before the user touches anything.
 */
export interface CanonicalFieldDef {
  key: string;
  label: string;
  icon: string;
  aliases: string[];
}

export const CANONICAL_FIELDS: readonly CanonicalFieldDef[] = [
  { key: 'titulo', label: 'Título', icon: '📝', aliases: ['titulo', 'title'] },
  { key: 'precio', label: 'Precio', icon: '💰', aliases: ['precio', 'price'] },
  { key: 'imagen', label: 'Imagen', icon: '📸', aliases: ['imagen', 'image'] },
  { key: 'url_producto', label: 'URL', icon: '🔗', aliases: ['url_producto', 'url'] },
];
