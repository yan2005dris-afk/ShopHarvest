/**
 * Stub — Shein extension export reader.
 *
 * Full implementation lands in PR 5 (extension-based-sources): it reads
 * `EXTENSION_EXPORT_PATH`, validates the JSON schema with zod, persists
 * the raw payload to `PIPELINE_RAW_DIR/shein/<capturedAt>.json`, and
 * throws `BadExtensionExportError` on miss/malformed. This stub keeps
 * the signature so the adapter can wire a static import today.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function readSheinExtensionExport(
  exportPath: string,
): Promise<import('@web-scraping/contracts/pipeline').ScrapeResult> {
  void exportPath;
  throw new Error(
    'shein: not implemented yet; see PR 5 (extension-based-sources)',
  );
}
