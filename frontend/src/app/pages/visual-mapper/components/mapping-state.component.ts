import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MappingSessionService } from '../services/mapping-session.service';
import { SaveActionsComponent } from './save-actions.component';
import { FieldConfigPanelComponent } from './field-config-panel.component';
import { ProductPreviewCardComponent } from './product-preview-card.component';

/**
 * The mapping results screen — three columns:
 *   1. Mapped Fields summary (what's currently mapped, + container) + remove
 *   2. Field config — pick the raw source for each preset canonical role
 *   3. Preview — a single paginated product card + per-field OK badges
 *
 * Container-only methodology: there is no more per-field click
 * assignment (see extension/src/content/mapper.ts). Everything here
 * reads/writes MappingSessionService, which already seeded a default
 * source for every canonical role on arrival (seedDefaultMappings).
 */
@Component({
  selector: 'app-mapping-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SaveActionsComponent, FieldConfigPanelComponent, ProductPreviewCardComponent],
  template: `
    <div class="ms-shell">
      <header class="ms-header">
        <div>
          <h2 class="ms-header__title">Visual Data Mapping</h2>
          <p class="ms-header__sub">
            Review the auto-detected fields and save when it looks right.
          </p>
        </div>
        @if (pageTitle()) {
          <div class="ms-header__chip">
            <span class="material-symbols-outlined" style="font-size: 18px">public</span>
            <span>{{ pageTitle() }}</span>
          </div>
        }
      </header>

      @if (extractedProductsLength() === 0) {
        <div class="ms-empty">
          <p>No products were found inside that container.</p>
          <button type="button" class="ms-empty__retry" (click)="onTryAgain.emit()">
            Try Again
          </button>
        </div>
      } @else {
        <div class="ms-grid">
          <aside class="ms-col ms-col--mapped">
            <div class="ms-card">
              <div class="ms-card__head">
                <h3 class="ms-card__title">Field Mappings</h3>
                <span class="ms-count-badge">{{ mappedFieldsCount() }} ACTIVE</span>
              </div>
              <div class="ms-fields-list">
                @for (mapping of fieldMappings(); track mapping.canonicalField) {
                  <div class="ms-field-row">
                    <span class="ms-field-dot ms-field-dot--used"></span>
                    <span class="ms-field-name">{{ mapping.canonicalField }}</span>
                    <button
                      class="ms-remove-btn"
                      (click)="removeAssignment(mapping.canonicalField)"
                      title="Remove"
                      aria-label="Remove mapping"
                    >
                      ×
                    </button>
                  </div>
                } @empty {
                  <p class="ms-empty-hint">Nothing mapped yet — pick sources on the right.</p>
                }
              </div>
            </div>

            <div class="ms-card">
              <h3 class="ms-card__title ms-card__title--sub">Product Container Selector</h3>
              @if (containerSelector(); as selector) {
                <code class="ms-selector">{{ selector }}</code>
                <p class="ms-selector-hint">
                  <span class="material-symbols-outlined" style="font-size: 16px">verified</span>
                  Valid selector path
                </p>
              } @else {
                <p class="ms-empty-hint">No container selected.</p>
              }
            </div>

            <div class="ms-card">
              <div class="ms-card__head">
                <h3 class="ms-card__title">All Detected Fields</h3>
                <span class="ms-count-badge ms-count-badge--muted">{{
                  availableFields().length
                }}</span>
              </div>
              <p class="ms-card__hint">
                Everything the extension found in the first product — not just what's mapped.
              </p>
              <div class="ms-fields-list">
                @for (field of availableFields(); track field.key) {
                  <div class="ms-raw-field" [class.ms-raw-field--used]="isUsedSource(field.key)">
                    <span
                      class="ms-field-dot"
                      [class.ms-field-dot--used]="isUsedSource(field.key)"
                    ></span>
                    <span class="ms-raw-field__key">{{ field.label }}</span>
                    <span class="ms-raw-field__value">{{ previewValue(field) }}</span>
                  </div>
                } @empty {
                  <p class="ms-empty-hint">Nothing detected yet.</p>
                }
              </div>
            </div>
          </aside>

          <section class="ms-col ms-col--config">
            <app-field-config-panel [session]="session()" />
          </section>

          <section class="ms-col ms-col--preview">
            <app-product-preview-card [session]="session()" />
          </section>
        </div>
      }

      <footer class="ms-footer">
        <span class="ms-footer__hint">{{ pageTitle() || 'Ready to save' }}</span>
        <app-save-actions
          [domainRuleSaved]="domainRuleSaved()"
          [productsIngested]="productsIngested()"
          [savingProducts]="savingProducts()"
          [ingestError]="ingestError()"
          [extractedProductsLength]="extractedProductsLength()"
          [isSaveEnabled]="isSaveEnabled()"
          (onSaveRule)="onSaveRule.emit()"
          (onSaveProducts)="onSaveProducts.emit()"
        />
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100dvh;
        overflow: hidden;
        background: var(--color-background);
      }

      .ms-shell {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }

      .ms-header {
        padding: 1.5rem 2rem 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .ms-header__title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }
      .ms-header__sub {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
        color: var(--color-on-surface-variant);
      }

      .ms-header__chip {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.5rem;
        font-size: 0.8125rem;
        color: var(--color-on-surface);
        max-width: 320px;
        overflow: hidden;
      }

      .ms-header__chip span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ms-grid {
        flex: 1;
        display: grid;
        grid-template-columns: minmax(240px, 3fr) minmax(320px, 5fr) minmax(280px, 4fr);
        gap: 1.5rem;
        padding: 0 2rem 1.5rem;
        overflow: hidden;
        min-height: 0;
      }

      .ms-col {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        overflow-y: auto;
      }
      .ms-col--config,
      .ms-col--preview {
        overflow: hidden;
      }

      .ms-card {
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.75rem;
        overflow: hidden;
      }

      .ms-card__head {
        padding: 0.875rem 1rem;
        border-bottom: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .ms-card__title {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }
      .ms-card__title--sub {
        padding: 0.875rem 1rem 0;
        text-transform: uppercase;
        font-size: 0.6875rem;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
        font-weight: 700;
      }

      .ms-count-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: var(--color-on-primary);
        background: var(--color-primary);
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
      }

      .ms-fields-list {
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .ms-field-row {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.5rem 0.625rem;
        border-radius: 0.5rem;
        transition: background 120ms ease;
      }

      .ms-field-row:hover {
        background: var(--color-surface-container);
      }

      .ms-field-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-outline-variant);
        flex-shrink: 0;
      }
      .ms-field-name {
        flex: 1;
        font-size: 0.8125rem;
        color: var(--color-on-surface);
      }

      .ms-count-badge--muted {
        color: var(--color-on-surface-variant);
        background: var(--color-surface-container-high);
      }

      .ms-card__hint {
        margin: 0.5rem 1rem 0;
        font-size: 0.6875rem;
        color: var(--color-on-surface-variant);
        line-height: 1.4;
      }

      .ms-raw-field {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.375rem 0.625rem;
        border-radius: 0.5rem;
      }

      .ms-raw-field--used {
        background: color-mix(in srgb, var(--color-success) 8%, transparent);
      }

      .ms-field-dot--used {
        background: var(--color-success);
      }

      .ms-raw-field__key {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-on-surface);
        white-space: nowrap;
      }

      .ms-raw-field__value {
        font-size: 0.6875rem;
        color: var(--color-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .ms-remove-btn {
        border: none;
        background: transparent;
        color: var(--color-danger);
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
      }

      .ms-remove-btn:hover {
        background: var(--color-danger-dim);
      }

      .ms-selector {
        display: block;
        margin: 0.75rem 1rem 0;
        padding: 0.625rem 0.75rem;
        background: var(--color-surface-container);
        border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
        border-radius: 0.5rem;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--color-primary);
        overflow-x: auto;
        white-space: nowrap;
      }

      .ms-selector-hint {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        margin: 0.5rem 1rem 1rem;
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
      }

      .ms-empty-hint {
        padding: 0.75rem 1rem;
        margin: 0;
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
        font-style: italic;
      }

      .ms-footer {
        padding: 1rem 2rem;
        border-top: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container-low);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .ms-footer__hint {
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ms-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        color: var(--color-on-surface-variant);
      }

      .ms-empty__retry {
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        border: none;
        background: var(--color-primary);
        color: var(--color-on-primary);
        font-weight: 600;
        cursor: pointer;
      }

      @media (max-width: 1100px) {
        .ms-grid {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
      }
    `,
  ],
})
export class MappingStateComponent {
  readonly session = input.required<MappingSessionService>();

  readonly fieldMappings = computed(() => this.session().fieldMappings());
  readonly containerSelector = computed(() => this.session().containerSelector());
  readonly pageTitle = computed(() => this.session().pageTitle());
  readonly mappedFieldsCount = computed(() => this.session().mappedFieldsCount());
  readonly isSaveEnabled = computed(() => this.session().isSaveEnabled());
  readonly extractedProductsLength = computed(() => this.session().extractedProducts().length);
  readonly availableFields = computed(() => this.session().availableFields());

  readonly domainRuleSaved = input.required<boolean>();
  readonly productsIngested = input.required<boolean>();
  readonly savingProducts = input.required<boolean>();
  readonly ingestError = input.required<string>();

  readonly onSaveRule = output<void>();
  readonly onSaveProducts = output<void>();
  readonly onTryAgain = output<void>();

  removeAssignment(key: string): void {
    this.session().removeAssignment(key);
  }

  /** True when a raw detected key is currently feeding some canonical field. */
  isUsedSource(rawKey: string): boolean {
    return this.session()
      .fieldMappings()
      .some((m) => m.extractedKey === rawKey);
  }

  previewValue(field: { selectedValue: string | number | null }): string {
    const v = field.selectedValue;
    if (v === null || v === undefined || v === '') return '—';
    const s = String(v);
    return s.length > 28 ? s.slice(0, 28) + '…' : s;
  }
}
