import { BadExtensionExportError } from './bad-extension-export.error.js';

/** One product row inside a Chrome extension export payload. */
export interface ExtensionExportProduct {
  productId: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  url: string;
}

/** Shape of `extension_export.json` produced by the Chrome extension. */
export interface ExtensionExport {
  source: 'temu' | 'shein';
  /** ISO-8601 timestamp of when the extension captured the export. */
  capturedAt: string;
  products: ExtensionExportProduct[];
}

const REQUIRED_PRODUCT_FIELDS: ReadonlyArray<{
  key: keyof ExtensionExportProduct;
  type: 'string' | 'number';
}> = [
  { key: 'productId', type: 'string' },
  { key: 'title', type: 'string' },
  { key: 'price', type: 'number' },
  { key: 'currency', type: 'string' },
  { key: 'category', type: 'string' },
  { key: 'url', type: 'string' },
];

/**
 * Validate a parsed JSON payload against the `ExtensionExport` schema.
 * Throws `BadExtensionExportError('schema', <field>)` on the first
 * violation found (EXT-3). Callers pass `expectedSource` so a Temu
 * adapter can't silently ingest a Shein export (or vice versa).
 */
export function validateExtensionExport(
  data: unknown,
  expectedSource: 'temu' | 'shein',
): ExtensionExport {
  if (typeof data !== 'object' || data === null) {
    throw new BadExtensionExportError('schema', 'root: expected an object');
  }
  const obj = data as Record<string, unknown>;

  if (obj['source'] !== expectedSource) {
    throw new BadExtensionExportError(
      'schema',
      `source: expected "${expectedSource}", got ${JSON.stringify(obj['source'])}`,
    );
  }

  if (
    typeof obj['capturedAt'] !== 'string' ||
    Number.isNaN(Date.parse(obj['capturedAt']))
  ) {
    throw new BadExtensionExportError(
      'schema',
      `capturedAt: expected an ISO-8601 string, got ${JSON.stringify(obj['capturedAt'])}`,
    );
  }

  if (!Array.isArray(obj['products'])) {
    throw new BadExtensionExportError(
      'schema',
      `products: expected an array, got ${typeof obj['products']}`,
    );
  }

  obj['products'].forEach((product: unknown, index: number) => {
    if (typeof product !== 'object' || product === null) {
      throw new BadExtensionExportError(
        'schema',
        `products[${index}]: expected an object`,
      );
    }
    const p = product as Record<string, unknown>;
    for (const field of REQUIRED_PRODUCT_FIELDS) {
      if (typeof p[field.key] !== field.type) {
        throw new BadExtensionExportError(
          'schema',
          `products[${index}].${field.key}: expected ${field.type}, got ${typeof p[field.key]}`,
        );
      }
    }
  });

  return obj as unknown as ExtensionExport;
}
