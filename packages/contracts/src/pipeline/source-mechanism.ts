/**
 * Declared acquisition mechanism per data source. Canonical home for
 * this map (backend/src/modules/pipeline/scraping/source-meta.ts keeps
 * a local copy in sync, per its own docstring).
 *
 *   - `playwright` — sources that boot a headless Chromium (MELI, AliExpress).
 *   - `extension`  — sources that consume the Chrome extension export (Temu, Shein).
 *   - `api`        — sources that hit a plain HTTP/JSON API (exchange rates).
 *   - `file`       — sources that load a local CSV file (csv, encuesta).
 */
export type SourceMechanism = 'playwright' | 'extension' | 'api' | 'file';

export const SOURCE_MECHANISM_MAP: Record<string, SourceMechanism> = {
  mercadolibre: 'playwright',
  aliexpress: 'playwright',
  temu: 'extension',
  shein: 'extension',
  api_rates: 'api',
  csv_dataset: 'file',
  encuesta: 'file',
};
