/**
 * Stub — Encuesta (Google Forms export) loader.
 *
 * Full `csv-parse` implementation lands in this PR as a port of the
 * legacy `legacy/pipeline/scripts/scraping/load_encuesta.ts`. The port
 * preserves the PII anonymization invariant (strip `nombre`, `email`,
 * `correo`, `Marca temporal`, `Timestamp` before persisting). Stub
 * keeps the signature so the adapter can wire a static import today.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function loadEncuesta(
  filePath: string,
): Promise<import('@web-scraping/contracts/pipeline').ScrapeResult> {
  void filePath;
  throw new Error(
    'encuesta-loader: not implemented yet; see PR 6 (etl-staging-dw-native)',
  );
}
