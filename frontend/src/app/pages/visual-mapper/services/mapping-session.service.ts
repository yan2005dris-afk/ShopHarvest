import { Injectable, signal, computed } from '@angular/core';
import { ExtensionFieldMapping, MappingCompletePayload } from '../../../services/extension.service';

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
  readonly extractedProducts = signal<Record<string, string | number | null>[]>([]);

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
    this.extractedProducts.set(payload.products ?? []);
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
    this.extractedProducts.set([]);
  }

  getFieldMapping(key: string): ExtensionFieldMapping | undefined {
    return this.fieldMappings().find((m) => m.canonicalField === key);
  }

  isFieldMapped(key: string): boolean {
    return !!this.getFieldMapping(key);
  }
}