/**
 * ETL constants — reference/dimension seed data ported from the
 * legacy `legacy/pipeline/scripts/dw/dw_load_staging.ts` (compiled
 * output preserved at `legacy/pipeline/dist/`, source deleted in
 * PR 1b). Values are ported 1:1 except where noted.
 */
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { EtlRunState } from '@web-scraping/contracts/pipeline';

export type { EtlRunState };
export const ETL_RUN_STATES: ReadonlyArray<EtlRunState> = [
  'queued',
  'running',
  'success',
  'failed',
];

/**
 * dim_fuente seed rows. Ported from legacy `FUENTES`, but expanded to
 * cover ALL 7 `PipelineSource` enum members (legacy only listed 5 —
 * omitted `api_rates`/`encuesta`, and used the label `archivos`
 * instead of the current `csv_dataset` enum value). ON CONFLICT DO
 * NOTHING semantics mean this only ADDS missing rows; it never
 * renames or removes a pre-existing `archivos` row from an older load
 * (ETL-6: every `PipelineSource` member needs a matching `dim_fuente` row).
 */
export const FUENTES: ReadonlyArray<{
  nombre: string;
  tipo: string;
  desc: string;
}> = [
  {
    nombre: PipelineSource.MERCADOLIBRE,
    tipo: 'scraping',
    desc: 'MercadoLibre Ecuador - Scraping Playwright',
  },
  {
    nombre: PipelineSource.ALIEXPRESS,
    tipo: 'scraping',
    desc: 'AliExpress - Scraping Playwright',
  },
  {
    nombre: PipelineSource.TEMU,
    tipo: 'extension',
    desc: 'Temu - Extracción vía Extensión Chrome',
  },
  {
    nombre: PipelineSource.SHEIN,
    tipo: 'extension',
    desc: 'Shein - Extracción vía Extensión Chrome',
  },
  {
    nombre: PipelineSource.API_RATES,
    tipo: 'api',
    desc: 'Tasas de cambio - API externa',
  },
  {
    nombre: PipelineSource.CSV_DATASET,
    tipo: 'archivo',
    desc: 'Dataset Kaggle E-Commerce - Archivo CSV estructurado',
  },
  {
    nombre: PipelineSource.ENCUESTA,
    tipo: 'archivo',
    desc: 'Encuesta propia de consumo - Fuente propia',
  },
];

/**
 * dim_categoria seed rows. Ported from legacy `CATEGORIAS`, plus
 * `sin_clasificar` — a real output of `classifyCategory()` (staging)
 * that the legacy seed list omitted, silently dropping any product
 * with a null title at DW-load time (`getDimId` returns null →
 * `skipped++`). Added defensively so no row is ever silently lost.
 */
export const CATEGORIAS: ReadonlyArray<{ nombre: string; desc: string }> = [
  {
    nombre: 'electronica',
    desc: 'Dispositivos electrónicos, computación y accesorios tecnológicos',
  },
  { nombre: 'hogar', desc: 'Productos para el hogar, cocina y decoración' },
  { nombre: 'moda', desc: 'Ropa, calzado y accesorios de moda' },
  { nombre: 'ropa', desc: 'Prendas de vestir en general' },
  {
    nombre: 'belleza',
    desc: 'Cosméticos, cuidado personal y perfumería',
  },
  { nombre: 'juguetes', desc: 'Juguetes, juegos y entretenimiento' },
  { nombre: 'deportes', desc: 'Artículos deportivos y fitness' },
  { nombre: 'otros', desc: 'Productos sin clasificación específica' },
  {
    nombre: 'sin_clasificar',
    desc: 'Producto sin título disponible para clasificar',
  },
];

/** dim_moneda seed rows. Ported 1:1 from legacy `MONEDAS`. */
export const MONEDAS: ReadonlyArray<{
  codigo: string;
  nombre: string;
  simbolo: string;
}> = [
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
  { codigo: 'GBP', nombre: 'Libra esterlina', simbolo: '£' },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
];

/** dim_calificacion seed rows. Ported 1:1 from legacy `CALIFICACIONES`. */
export const CALIFICACIONES: ReadonlyArray<{ nivel: string; valor: number }> = [
  { nivel: 'One', valor: 1 },
  { nivel: 'Two', valor: 2 },
  { nivel: 'Three', valor: 3 },
  { nivel: 'Four', valor: 4 },
  { nivel: 'Five', valor: 5 },
];

/** dim_genero seed rows. Ported 1:1 from legacy `GENEROS`. */
export const GENEROS: ReadonlyArray<{ nombre: string; abrev: string }> = [
  { nombre: 'Masculino', abrev: 'M' },
  { nombre: 'Femenino', abrev: 'F' },
];

export const NOMBRES_MES: ReadonlyArray<string> = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Category classification keyword map. Ported 1:1 from legacy
 * `stg_classify.ts` (`CATEGORY_MAP`).
 */
export const CATEGORY_MAP: Readonly<Record<string, readonly string[]>> = {
  electronica: [
    'phone',
    'laptop',
    'tablet',
    'auricular',
    'speaker',
    'cable',
    'cargador',
    'monitor',
    'keyboard',
    'mouse',
    'camara',
    'camera',
  ],
  ropa: [
    'shirt',
    'dress',
    'pants',
    'shoes',
    'zapatilla',
    'vestido',
    'camisa',
    'blusa',
    'jean',
    'sweater',
    'jacket',
    'coat',
  ],
  hogar: [
    'lamp',
    'chair',
    'sofa',
    'pillow',
    'lámpara',
    'silla',
    'almohada',
    'curtain',
    'towel',
    'toalla',
    'blanket',
  ],
  belleza: [
    'cream',
    'mascara',
    'lipstick',
    'perfume',
    'crema',
    'labial',
    'serum',
    'shampoo',
    'conditioner',
  ],
  deportes: [
    'gym',
    'yoga',
    'running',
    'fitness',
    'sport',
    'bicycle',
    'bicicleta',
    'treadmill',
  ],
  juguetes: [
    'toy',
    'juguete',
    'lego',
    'doll',
    'muñeca',
    'puzzle',
    'game',
    'juego',
  ],
};

/** Classify a product title into a master category (ported from stg_classify.ts). */
export function classifyCategory(titulo: string | null | undefined): string {
  if (!titulo) return 'sin_clasificar';
  const lower = titulo.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'otros';
}
