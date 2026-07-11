/**
 * Thrown by the Temu/Shein adapters when `extension_export.json` is
 * missing, unparsable, or fails schema validation. There is zero demo
 * fallback for extension-based sources — this error is the only
 * outcome besides a successful read (EXT-2, EXT-3).
 */
export class BadExtensionExportError extends Error {
  readonly reason: 'missing' | 'schema' | 'parse';

  constructor(reason: 'missing' | 'schema' | 'parse', detail: string) {
    super(`${reason}: ${detail}`);
    this.name = 'BadExtensionExportError';
    this.reason = reason;
  }
}
