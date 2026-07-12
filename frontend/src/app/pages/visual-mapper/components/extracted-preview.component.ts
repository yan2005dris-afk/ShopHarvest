import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MappingSessionService } from '../services/mapping-session.service';

const IMAGE_FIELD_PATTERNS = /^(image|img|foto|photo|picture|thumbnail|icon|imagen)/i;
const TITLE_FIELD_PATTERNS = /^(title|name|nombre|titulo|producto?)/i;
const PRICE_FIELD_PATTERNS = /^(price|cost|precio|pricing|amount)/i;

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
    @if (session().extractedProducts().length > 0) {
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
    .vm-panel-header { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 600; color: var(--text-2); }

    .vm-product-cards { display: flex; flex-direction: column; gap: 1rem; }

    .vm-product-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .vm-prod-image-wrap {
      width: 100%;
      max-height: 200px;
      overflow: hidden;
      background: var(--surface-2);
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border);
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
      color: var(--text-1);
      line-height: 1.4;
    }
    .vm-prod-price {
      font-size: 1.125rem;
      font-weight: 800;
      color: var(--accent);
    }

    .vm-prod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem 1rem; margin-top: 0.25rem; }
    .vm-prod-field { display: flex; flex-direction: column; gap: 0.0625rem; }
    .vm-prod-field:has(.vm-prod-label:is(:empty)) { grid-column: 1 / -1; }
    .vm-prod-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); }
    .vm-prod-value { font-size: 0.75rem; color: var(--text-2); word-break: break-all; }

    /* Field-type badges row */
    .vm-prod-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border); }
    .vm-badge { font-size: 0.75rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; line-height: 1.4; }
    .vm-badge.badge-img   { background: #dbeafe; color: #1d4ed8; }
    .vm-badge.badge-title { background: #fef3c7; color: #b45309; }
    .vm-badge.badge-price { background: #d1fae5; color: #047857; }

    .vm-preview-msg { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; gap: 1rem; color: var(--text-3); }
    .vm-preview-msg svg { color: var(--success); }
    .vm-preview-msg p { margin: 0; font-size: 0.9375rem; color: var(--text-2); }
    .vm-summary-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1rem 1.25rem; text-align: left; max-width: 400px; font-size: 0.875rem; color: var(--text-2); line-height: 1.6; }
    .vm-summary-box code { font-family: var(--font-mono); font-size: 0.75rem; background: var(--surface-2); padding: 0.125rem 0.375rem; border-radius: 0.25rem; color: var(--text-1); }
    .vm-preview-sub { font-size: 0.8125rem; color: var(--text-3) !important; }
    .vm-retry-link { cursor: pointer; text-decoration: underline; color: var(--accent); }
    .vm-preview-saved-badge { font-size: 0.875rem; font-weight: 600; color: var(--success); margin-top: 0.5rem; }
  `],
})
export class ExtractedPreviewComponent {
  readonly session = input.required<MappingSessionService>();
  readonly domainRuleSaved = input.required<boolean>();
  readonly onTryAgain = output<void>();

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
