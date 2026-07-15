import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { MappingSessionService, ExtractedFieldOption } from '../services/mapping-session.service';

const IMAGE_FIELD_PATTERNS = /^(image|img|foto|photo|picture|thumbnail|icon|imagen)/i;
const TITLE_FIELD_PATTERNS = /^(title|name|nombre|titulo|producto?)/i;
const PRICE_FIELD_PATTERNS = /^(price|cost|precio|pricing|amount)/i;

const CANONICAL_NAMES = {
  title: ['titulo', 'title', 'nombre', 'name', 'producto'],
  price: ['precio', 'price', 'precio_oferta'],
  image: ['imagen', 'image', 'foto', 'img'],
  url: ['url', 'url_producto', 'link'],
};

/**
 * Maps a canonical field name to its badge label and CSS class.
 */
function fieldTypeBadge(name: string): { label: string; cls: string } | null {
  const n = name.trim();
  if (IMAGE_FIELD_PATTERNS.test(n)) return { label: '📸', cls: 'badge-img' };
  if (TITLE_FIELD_PATTERNS.test(n))  return { label: '📝', cls: 'badge-title' };
  if (PRICE_FIELD_PATTERNS.test(n))  return { label: '💰', cls: 'badge-price' };
  return null;
}

@Component({
  selector: 'app-extracted-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session().extractAllMode() && session().availableFields().length > 0) {
      <!-- ExtractAll Mode: Always show field picker + products preview -->
      <div class="vm-extractall-layout">
        <!-- Left: Field picker -->
        <div class="vm-extractall-panel">
          <div class="vm-panel-header">
            <h3>📦 {{ session().extractedProducts().length }} product(s)</h3>
            <p class="vm-extractall-hint">Select which extracted fields to use</p>
          </div>

          <!-- Field selector for canonical names -->
          <div class="vm-field-picker">
            @for (field of session().availableFields(); track field.key) {
              <div class="vm-extractall-field">
                <div class="vm-extractall-field-header">
                  <span class="vm-extractall-field-label">{{ field.label }}</span>
                  <select
                    class="vm-canonical-select"
                    (change)="onCanonicalChange(field.key, $event)">
                    <option value="">-- Skip --</option>
                    @for (canon of canonicalNames; track canon.key) {
                      <option [value]="canon.key" [selected]="isMappedTo(field.key, canon.key)">
                        {{ canon.label }}
                      </option>
                    }
                  </select>
                </div>
                <div class="vm-extractall-values">
                  @for (val of field.values; track $index) {
                    <span class="vm-extractall-value"
                      [class.selected]="val === field.selectedValue"
                      [class.is-image]="isImageValue(val)"
                      [class.is-price]="isPriceValue(val)">
                      @if (isImageValue(val)) {
                        <img [src]="val" alt="" class="vm-value-thumb" />
                      } @else {
                        {{ truncate(val) }}
                      }
                    </span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Selected mappings summary -->
          @if (session().fieldMappings().length > 0) {
            <div class="vm-mapping-summary">
              <h4>Selected:</h4>
              <div class="vm-mapping-list">
                @for (mapping of session().fieldMappings(); track mapping.canonicalField) {
                  <span class="vm-mapping-chip">
                    {{ mapping.canonicalField }}
                  </span>
                }
              </div>
            </div>
          }
        </div>

        <!-- Right: Products preview -->
        <div class="vm-products-panel">
          <div class="vm-panel-header">
            <h3>Preview</h3>
          </div>
          <div class="vm-product-cards">
            @for (prod of session().extractedProducts(); track $index) {
              <div class="vm-product-card">
                <!-- Image -->
                @if (imageField(); as imgKey) {
                  @if (prod[imgKey]) {
                    <div class="vm-prod-image-wrap">
                      <img [src]="prod[imgKey]" alt="" class="vm-prod-image" loading="lazy" />
                    </div>
                  }
                }

                <div class="vm-prod-body">
                  <!-- Title (prominent) -->
                  @if (titleField(); as titleKey) {
                    @if (prod[titleKey]) {
                      <div class="vm-prod-title">{{ prod[titleKey] }}</div>
                    }
                  }

                  <!-- Price (highlighted) -->
                  @if (priceField(); as priceKey) {
                    @if (prod[priceKey]) {
                      <div class="vm-prod-price">{{ prod[priceKey] }}</div>
                    }
                  }

                  <!-- Remaining fields (compact) with type badges -->
                  <div class="vm-prod-grid">
                    @for (field of session().fieldMappings(); track field.canonicalField) {
                      @if (
                        !isImageField(field.canonicalField) &&
                        !isTitleField(field.canonicalField) &&
                        !isPriceField(field.canonicalField)
                      ) {
                        @if (prod[field.canonicalField] != null) {
                          <div class="vm-prod-field">
                            <span class="vm-prod-label">{{ field.canonicalField }}</span>
                            <span class="vm-prod-value">{{ prod[field.canonicalField] }}</span>
                          </div>
                        }
                      }
                    }
                  </div>

                  <!-- Field-type badges for this product -->
                  <div class="vm-prod-badges">
                    @for (field of session().fieldMappings(); track field.canonicalField) {
                      @if (badgeLabel(field.canonicalField); as badge) {
                        <span class="vm-badge {{ badge.cls }}">{{ badge.label }}</span>
                      }
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    } @else if (session().extractedProducts().length > 0) {
      <div class="vm-products-panel">
        <div class="vm-panel-header">
          <h3>{{ session().extractedProducts().length }} product(s) extracted</h3>
        </div>
        <div class="vm-product-cards">
          @for (prod of session().extractedProducts(); track $index) {
            <div class="vm-product-card">
              <!-- Image -->
              @if (imageField(); as imgKey) {
                @if (prod[imgKey]) {
                  <div class="vm-prod-image-wrap">
                    <img [src]="prod[imgKey]" alt="" class="vm-prod-image" loading="lazy" />
                  </div>
                }
              }

              <div class="vm-prod-body">
                <!-- Title (prominent) -->
                @if (titleField(); as titleKey) {
                  @if (prod[titleKey]) {
                    <div class="vm-prod-title">{{ prod[titleKey] }}</div>
                  }
                }

                <!-- Price (highlighted) -->
                @if (priceField(); as priceKey) {
                  @if (prod[priceKey]) {
                    <div class="vm-prod-price">{{ prod[priceKey] }}</div>
                  }
                }

                <!-- Remaining fields (compact) with type badges -->
                <div class="vm-prod-grid">
                  @for (field of session().fieldMappings(); track field.canonicalField) {
                    @if (
                      !isImageField(field.canonicalField) &&
                      !isTitleField(field.canonicalField) &&
                      !isPriceField(field.canonicalField)
                    ) {
                      @if (prod[field.canonicalField] != null) {
                        <div class="vm-prod-field">
                          <span class="vm-prod-label">{{ field.canonicalField }}</span>
                          <span class="vm-prod-value">{{ prod[field.canonicalField] }}</span>
                        </div>
                      }
                    }
                  }
                </div>

                <!-- Field-type badges for this product -->
                <div class="vm-prod-badges">
                  @for (field of session().fieldMappings(); track field.canonicalField) {
                    @if (badgeLabel(field.canonicalField); as badge) {
                      <span class="vm-badge {{ badge.cls }}">{{ badge.label }}</span>
                    }
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="vm-preview-msg">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <p>Mapping received from extension</p>

        <div class="vm-summary-box">
          <p><strong>{{ session().mappedFieldsCount() }}</strong> field(s) mapped</p>
          @if (session().containerSelector()) {
            <p>Container: <code>{{ session().containerSelector() }}</code></p>
          }
          <p class="vm-preview-sub">
            These fields will be applied to each product on the page.
          </p>
          <p class="vm-preview-sub">
            💡 Scroll down in the extension tab to load more items before clicking Finish Mapping,
            or close this and <a class="vm-hint-link vm-retry-link" (click)="onTryAgain.emit()">try again</a>.
          </p>
        </div>

        @if (domainRuleSaved()) {
          <p class="vm-preview-saved-badge">✅ Domain rule saved</p>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .vm-products-panel { flex: 1; overflow-y: auto; }
    .vm-panel-header { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 600; color: var(--color-on-surface-variant); }

    .vm-extractall-layout { display: flex; gap: 1rem; height: 100%; overflow: hidden; }
    .vm-extractall-layout .vm-extractall-panel { width: 320px; min-width: 320px; overflow-y: auto; padding: 0.5rem 1rem; }
    .vm-extractall-layout .vm-products-panel { flex: 1; overflow-y: auto; }
    .vm-extractall-hint { margin: 0.25rem 0 0; font-size: 0.8125rem; color: var(--color-on-surface-variant); font-weight: 400; }
    .vm-extractall-field { background: var(--color-surface-container-low); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 0.75rem; }
    .vm-extractall-field-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
    .vm-extractall-field-label { font-size: 0.8125rem; font-weight: 600; color: var(--color-on-surface); }
    .vm-canonical-select { background: var(--color-surface-container); border: 1px solid var(--color-outline-variant); border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--color-on-surface); cursor: pointer; }
    .vm-extractall-values { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .vm-extractall-value { display: inline-flex; align-items: center; padding: 0.25rem 0.5rem; background: var(--color-surface-container); border: 1px solid var(--color-outline-variant); border-radius: 0.25rem; font-size: 0.6875rem; color: var(--color-on-surface-variant); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vm-extractall-value.selected { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); }
    .vm-extractall-value.is-price { color: var(--color-success); border-color: var(--color-success-border); }
    .vm-value-thumb { width: 24px; height: 24px; object-fit: cover; border-radius: 2px; }
    .vm-mapping-summary { margin-top: 1rem; padding: 0.75rem; background: var(--color-surface-container-low); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-md); }
    .vm-mapping-summary h4 { margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-on-surface-variant); }
    .vm-mapping-list { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .vm-mapping-chip { display: inline-flex; padding: 0.25rem 0.5rem; background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); border-radius: 999px; font-size: 0.75rem; font-weight: 600; }

    .vm-product-cards { display: flex; flex-direction: column; gap: 1rem; }

    .vm-product-card {
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .vm-prod-image-wrap {
      width: 100%;
      max-height: 200px;
      overflow: hidden;
      background: var(--color-surface-container);
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--color-outline-variant);
    }
    .vm-prod-image {
      display: block;
      max-width: 100%;
      max-height: 200px;
      object-fit: contain;
    }

    .vm-prod-body { padding: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; }

    .vm-prod-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--color-on-surface);
      line-height: 1.4;
    }
    .vm-prod-price {
      font-size: 1.125rem;
      font-weight: 800;
      color: var(--color-primary);
    }

    .vm-prod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem 1rem; margin-top: 0.25rem; }
    .vm-prod-field { display: flex; flex-direction: column; gap: 0.0625rem; }
    .vm-prod-field:has(.vm-prod-label:is(:empty)) { grid-column: 1 / -1; }
    .vm-prod-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-on-surface-variant); }
    .vm-prod-value { font-size: 0.75rem; color: var(--color-on-surface-variant); word-break: break-all; }

    /* Field-type badges row */
    .vm-prod-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--color-outline-variant); }
    .vm-badge { font-size: 0.75rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; line-height: 1.4; }
    .vm-badge.badge-img   { background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); }
    .vm-badge.badge-title { background: var(--color-warning-dim); color: var(--color-warning); }
    .vm-badge.badge-price { background: var(--color-success-dim); color: var(--color-success); }

    .vm-preview-msg { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; gap: 1rem; color: var(--color-on-surface-variant); }
    .vm-preview-msg svg { color: var(--color-success); }
    .vm-preview-msg p { margin: 0; font-size: 0.9375rem; color: var(--color-on-surface-variant); }
    .vm-summary-box { background: var(--color-surface-container-low); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); padding: 1rem 1.25rem; text-align: left; max-width: 400px; font-size: 0.875rem; color: var(--color-on-surface-variant); line-height: 1.6; }
    .vm-summary-box code { font-family: var(--font-mono); font-size: 0.75rem; background: var(--color-surface-container); padding: 0.125rem 0.375rem; border-radius: 0.25rem; color: var(--color-on-surface); }
    .vm-preview-sub { font-size: 0.8125rem; color: var(--color-on-surface-variant) !important; }
    .vm-retry-link { cursor: pointer; text-decoration: underline; color: var(--color-primary); }
    .vm-preview-saved-badge { font-size: 0.875rem; font-weight: 600; color: var(--color-success); margin-top: 0.5rem; }
  `],
})
export class ExtractedPreviewComponent {
  readonly session = input.required<MappingSessionService>();
  readonly domainRuleSaved = input.required<boolean>();
  readonly onTryAgain = output<void>();

  readonly canonicalNames = [
    { key: 'titulo', label: '📝 Título' },
    { key: 'precio', label: '💰 Precio' },
    { key: 'imagen', label: '📸 Imagen' },
    { key: 'url_producto', label: '🔗 URL' },
  ];

  /** Name of the first field that looks like an image source. */
  imageField(): string | null {
    return this.findFirst(IMAGE_FIELD_PATTERNS);
  }

  /** Name of the first field that looks like a product title. */
  titleField(): string | null {
    return this.findFirst(TITLE_FIELD_PATTERNS);
  }

  /** Name of the first field that looks like a price. */
  priceField(): string | null {
    return this.findFirst(PRICE_FIELD_PATTERNS);
  }

  isImageField(name: string): boolean {
    return IMAGE_FIELD_PATTERNS.test(name.trim());
  }

  isTitleField(name: string): boolean {
    return TITLE_FIELD_PATTERNS.test(name.trim());
  }

  isPriceField(name: string): boolean {
    return PRICE_FIELD_PATTERNS.test(name.trim());
  }

  isImageValue(val: string | number | null): boolean {
    return typeof val === 'string' && (val.startsWith('http') || val.includes('data:image'));
  }

  isPriceValue(val: string | number | null): boolean {
    return typeof val === 'number' || (typeof val === 'string' && /^[\$\€\£]?[\d.,]+$/.test(val.trim()));
  }

  truncate(val: string | number | null): string {
    if (val === null) return '';
    const s = String(val);
    return s.length > 40 ? s.substring(0, 40) + '…' : s;
  }

  isMappedTo(extractedKey: string, canonicalName: string): boolean {
    const mappings = this.session().fieldMappings();
    return mappings.some(m => m.canonicalField === canonicalName && m.extractedKey === extractedKey);
  }

  onCanonicalChange(extractedKey: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const canonicalName = select.value;
    if (canonicalName) {
      this.session().selectFieldForMapping(extractedKey, canonicalName);
    }
  }

  private findFirst(pattern: RegExp): string | null {
    for (const m of this.session().fieldMappings()) {
      if (pattern.test(m.canonicalField.trim())) {
        return m.canonicalField;
      }
    }
    return null;
  }

  readonly badgeLabel = fieldTypeBadge;
}
