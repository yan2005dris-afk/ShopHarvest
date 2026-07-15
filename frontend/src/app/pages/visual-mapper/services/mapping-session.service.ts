import { Injectable, signal, computed } from '@angular/core';
import { ExtensionFieldMapping, MappingCompletePayload } from '../../../services/extension.service';
import { CANONICAL_FIELDS } from './canonical-fields';

/**
 * A field extracted from the container with all available values
 */
export interface ExtractedFieldOption {
  key: string;
  label: string;
  values: (string | number | null)[];
  selectedValue: string | number | null;
}

/**
 * Pure UI state for the Visual Mapper session.
 * Does NOT call the API — only holds the mapping data received from
 * the extension and provides derived signals for the template.
 */
@Injectable({ providedIn: 'root' })
export class MappingSessionService {
  // ─── Raw state ────────────────────────────────────────────────
  readonly fieldMappings = signal<ExtensionFieldMapping[]>([]);
  readonly containerSelector = signal<string | null>(null);
  readonly pageTitle = signal<string | null>(null);
  readonly extractedProducts = signal<Record<string, string | number | null | string[] | number[] | null>[]>([]);

  /** Original products from extension — never mutated */
  private readonly _originalProducts = signal<Record<string, string | number | null | string[] | number[] | null>[]>([]);
  readonly extractAllMode = signal<boolean>(false);

  /** All available fields when in extractAll mode */
  readonly availableFields = signal<ExtractedFieldOption[]>([]);

  // ─── Derived ──────────────────────────────────────────────────
  readonly mappedFieldsCount = computed(() => this.fieldMappings().length);
  readonly totalFieldCount = computed(() => this.fieldMappings().length);
  readonly isSaveEnabled = computed(
    () => this.fieldMappings().length > 0 && !!this.containerSelector(),
  );

  // ─── Mutators (called by page component) ─────────────────────
  applyExtensionResult(payload: MappingCompletePayload): void {
    this.fieldMappings.set(payload.fieldMappings);
    this.containerSelector.set(payload.containerSelector);
    this.pageTitle.set(payload.pageTitle);
    const products = payload.products ?? [];
    this._originalProducts.set(products);
    this.extractedProducts.set(products);
    this.extractAllMode.set(payload.extractAll ?? false);

    if (payload.extractAll && products.length > 0) {
      this.computeAvailableFields(products[0]);
      this.seedDefaultMappings();
    }
  }

  /**
   * Pre-fill each preset canonical field (título, precio, imagen,
   * url_producto — see CANONICAL_FIELDS) with a sensible default
   * source: extractAllFromContainer already writes both a Spanish key
   * and an English alias per role, so an exact-name match is almost
   * always available on the first pass. The user can still override
   * any of these from the field-config panel.
   *
   * This also matters for correctness, not just convenience:
   * applyCanonicalMappings() only copies canonical names that have an
   * explicit fieldMappings entry — without seeding all four up front,
   * touching just one dropdown would silently drop the other three
   * from the saved products.
   */
  private seedDefaultMappings(): void {
    const available = new Set(this.availableFields().map((f) => f.key));
    const seeded: ExtensionFieldMapping[] = [];
    for (const field of CANONICAL_FIELDS) {
      const alias = field.aliases.find((a) => available.has(a));
      if (alias) {
        seeded.push({ canonicalField: field.key, selector: '', type: 'text', extractedKey: alias });
      }
    }
    if (seeded.length > 0) {
      this.fieldMappings.set(seeded);
      this.applyCanonicalMappings();
    }
  }

  /**
   * Transform extracted products to use canonical field names
   * Only applied in extractAll mode after user selects mappings
   */
  /**
   * Transform extracted products to use canonical field names.
   * Called when user selects fields in extractAll mode.
   */
  applyCanonicalMappings(): void {
    const mappingByCanonical = new Map<string, string>();
    for (const m of this.fieldMappings()) {
      if (m.extractedKey) {
        mappingByCanonical.set(m.canonicalField, m.extractedKey);
      }
    }

    if (mappingByCanonical.size === 0) {
      // No mappings selected — show original products
      this.extractedProducts.set(this._originalProducts());
      return;
    }

    // Always transform from ORIGINAL products to avoid data loss
    const canonicalProducts = this._originalProducts().map(product => {
      const canonical: Record<string, string | number | null | string[] | number[] | null> = {};
      for (const [canonicalName, extractedKey] of mappingByCanonical) {
        if (extractedKey in product) {
          canonical[canonicalName] = product[extractedKey];
        }
      }
      return canonical;
    });

    this.extractedProducts.set(canonicalProducts);
  }

  /**
   * When in extractAll mode, compute all available fields from the first product
   * and let user pick which ones to map to canonical names
   */
  private computeAvailableFields(product: Record<string, string | number | null | string[] | number[] | null>): void {
    const options: ExtractedFieldOption[] = [];

    for (const [key, value] of Object.entries(product)) {
      if (key.startsWith('_')) continue; // Skip internal fields

      const allValues = this.collectAllValues(value);
      if (allValues.length === 0) continue;

      options.push({
        key,
        label: this.humanizeFieldName(key),
        values: allValues.slice(0, 5), // Limit to 5 values in picker
        selectedValue: allValues[0],
      });
    }

    this.availableFields.set(options);
  }

  private collectAllValues(value: string | number | null | string[] | number[] | null): (string | number | null)[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  private humanizeFieldName(key: string): string {
    // Convert camelCase or snake_case to readable label
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, str => str.toUpperCase());
  }

  /**
   * User picks a field to use as canonical field - add to fieldMappings
   */
  selectFieldForMapping(extractedKey: string, canonicalName: string): void {
    // Remove any existing mapping for this canonical name
    this.fieldMappings.update(arr =>
      arr.filter(m => m.canonicalField !== canonicalName)
    );

    // Add new mapping with the extracted key
    const mapping: ExtensionFieldMapping = {
      canonicalField: canonicalName,
      selector: '', // No selector needed in extractAll mode
      type: 'text',
      extractedKey,
    };

    this.fieldMappings.update(arr => [...arr, mapping]);

    // Transform products to use canonical names
    this.applyCanonicalMappings();
  }

  removeAssignment(fieldKey: string): void {
    this.fieldMappings.update((arr) =>
      arr.filter((m) => m.canonicalField !== fieldKey),
    );
  }

  reset(): void {
    this.fieldMappings.set([]);
    this.containerSelector.set(null);
    this.pageTitle.set(null);
    this._originalProducts.set([]);
    this.extractedProducts.set([]);
    this.extractAllMode.set(false);
    this.availableFields.set([]);
  }

  getFieldMapping(key: string): ExtensionFieldMapping | undefined {
    return this.fieldMappings().find((m) => m.canonicalField === key);
  }

  isFieldMapped(key: string): boolean {
    return !!this.getFieldMapping(key);
  }
}