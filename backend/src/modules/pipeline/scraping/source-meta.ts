/**
 * Source metadata — declared mechanism per data source.
 *
 * Lives in `scraping/` for PR 1b (per EXT-7) and is re-exported by
 * `etl/etl.constants.ts` in PR 6. The four mechanisms are:
 *
 *   - `playwright` — sources that boot a headless Chromium (MELI, AliExpress).
 *   - `extension` — sources that consume the Chrome extension export (Temu, Shein).
 *   - `api`       — sources that hit a plain HTTP/JSON API (exchange rates).
 *   - `file`      — sources that load a local CSV file (csv, encuesta).
 *
 * PR 5 introduces `packages/contracts/src/pipeline/source-mechanism.ts`
 * which is the canonical home of this map; this file stays in sync.
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

export function getMechanism(source: string): SourceMechanism {
  const mechanism = SOURCE_MECHANISM_MAP[source];
  if (!mechanism) {
    throw new Error(
      `source-meta: no mechanism declared for source "${source}" — add it to SOURCE_MECHANISM_MAP`,
    );
  }
  return mechanism;
}
