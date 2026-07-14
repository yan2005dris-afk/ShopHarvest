/**
 * Stub — CSV dataset loader.
 *
 * Full `csv-parse` implementation lands in this PR as a port of the
 * legacy `legacy/pipeline/scripts/scraping/load_csv.ts`. The port will
 * read `extra.inputPath` from `config`, parse with `csv-parse/sync`
 * (`columns: true`, `skip_empty_lines: true`), and persist the records
 * under `PIPELINE_RAW_DIR/archivos/`. Stub keeps the signature so the
 * adapter can wire a static import today.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function loadCsvDataset(
  filePath: string,
): Promise<import('@web-scraping/contracts/pipeline').ScrapeResult> {
  void filePath;
  throw new Error(
    'csv-loader: not implemented yet; see PR 6 (etl-staging-dw-native)',
  );
}
