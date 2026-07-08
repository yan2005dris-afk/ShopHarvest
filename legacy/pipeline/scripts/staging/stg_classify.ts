// Clasifica productos en categorías maestras por palabras clave del título
const CATEGORY_MAP: Record<string, string[]> = {
  electronica:  ['phone', 'laptop', 'tablet', 'auricular', 'speaker', 'cable', 'cargador', 'monitor', 'keyboard', 'mouse', 'camara', 'camera'],
  ropa:         ['shirt', 'dress', 'pants', 'shoes', 'zapatilla', 'vestido', 'camisa', 'blusa', 'jean', 'sweater', 'jacket', 'coat'],
  hogar:        ['lamp', 'chair', 'sofa', 'pillow', 'lámpara', 'silla', 'almohada', 'curtain', 'towel', 'toalla', 'blanket'],
  belleza:      ['cream', 'mascara', 'lipstick', 'perfume', 'crema', 'labial', 'serum', 'shampoo', 'conditioner'],
  deportes:     ['gym', 'yoga', 'running', 'fitness', 'sport', 'bicycle', 'bicicleta', 'treadmill'],
  juguetes:     ['toy', 'juguete', 'lego', 'doll', 'muñeca', 'puzzle', 'game', 'juego'],
};

export function classifyCategory(titulo: string | null): string {
  if (!titulo) return 'sin_clasificar';
  const lower = titulo.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'otros';
}
