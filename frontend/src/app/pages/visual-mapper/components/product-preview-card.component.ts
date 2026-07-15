import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MappingSessionService } from '../services/mapping-session.service';
import { CANONICAL_FIELDS } from '../services/canonical-fields';

type ProductRecord = Record<string, string | number | null | string[] | number[] | null>;

/**
 * Right column of the mapping screen — a single paginated product
 * card so the user can eyeball the CURRENT canonical mapping against
 * a real scraped product, plus a per-field OK/pending badge row
 * ("Mapped Fields X/4"). Paging is local to this component; it never
 * mutates session state, only reads it.
 */
@Component({
  selector: 'app-product-preview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pp-panel">
      <header class="pp-header">
        <h3 class="pp-title">Preview</h3>
        @if (total() > 0) {
          <div class="pp-pager">
            <button
              type="button"
              class="pp-pager__btn"
              [disabled]="index() === 0"
              (click)="prev()"
              aria-label="Previous product"
            >
              ‹
            </button>
            <span class="pp-pager__count">{{ index() + 1 }} / {{ total() }}</span>
            <button
              type="button"
              class="pp-pager__btn"
              [disabled]="index() >= total() - 1"
              (click)="next()"
              aria-label="Next product"
            >
              ›
            </button>
          </div>
        }
      </header>

      <div class="pp-body">
        @if (product(); as p) {
          <article class="pp-card">
            <div class="pp-card__image-wrap">
              @if (imageUrl(p); as src) {
                <img [src]="src" alt="" class="pp-card__image" loading="lazy" />
              } @else {
                <span class="pp-card__image-fallback material-symbols-outlined">image</span>
              }
            </div>

            <div class="pp-card__body">
              <span class="pp-card__eyebrow">Título</span>
              <h4 class="pp-card__title">{{ fieldValue(p, 'titulo') || '—' }}</h4>

              <div class="pp-card__price-row">
                <div>
                  <span class="pp-card__eyebrow">Precio</span>
                  <p class="pp-card__price">{{ formattedPrice(p) }}</p>
                </div>
              </div>
            </div>
          </article>

          <div class="pp-summary">
            <div class="pp-summary__head">
              <span>Mapped Fields</span>
              <span class="pp-summary__ratio">{{ matchedCount(p) }}/{{ canonicalFields.length }} Match</span>
            </div>
            <div class="pp-badges">
              @for (field of canonicalFields; track field.key) {
                <span
                  class="pp-badge"
                  [class.pp-badge--ok]="hasValue(p, field.key)"
                >
                  {{ field.label }} {{ hasValue(p, field.key) ? 'OK' : '—' }}
                </span>
              }
            </div>
          </div>
        } @else {
          <p class="pp-empty">No products extracted from this container.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }

      .pp-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.75rem;
        overflow: hidden;
      }

      .pp-header {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .pp-title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }

      .pp-pager {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .pp-pager__btn {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.5rem;
        color: var(--color-on-surface-variant);
        font-size: 1rem;
        cursor: pointer;
        line-height: 1;
      }

      .pp-pager__btn:hover:not(:disabled) {
        color: var(--color-on-surface);
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      }

      .pp-pager__btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .pp-pager__count {
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-on-surface);
        font-variant-numeric: tabular-nums;
      }

      .pp-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
      }

      .pp-card {
        width: 100%;
        max-width: 260px;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.75rem;
        padding: 0.875rem;
        box-shadow: 0 4px 16px color-mix(in srgb, var(--color-on-background) 8%, transparent);
      }

      .pp-card__image-wrap {
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 0.5rem;
        overflow: hidden;
        background: var(--color-surface-container);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.75rem;
      }

      .pp-card__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .pp-card__image-fallback {
        color: var(--color-on-surface-variant);
        font-size: 32px;
      }

      .pp-card__eyebrow {
        display: block;
        font-size: 0.5625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-primary);
        margin-bottom: 0.25rem;
      }

      .pp-card__title {
        margin: 0 0 0.75rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--color-on-surface);
        line-height: 1.4;
      }

      .pp-card__price {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }

      .pp-summary {
        width: 100%;
      }

      .pp-summary__head {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
        border-bottom: 1px solid var(--color-outline-variant);
        padding-bottom: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .pp-summary__ratio {
        font-weight: 700;
        color: var(--color-primary);
      }

      .pp-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .pp-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        background: var(--color-surface-container);
        color: var(--color-on-surface-variant);
        border: 1px solid var(--color-outline-variant);
      }

      .pp-badge--ok {
        background: var(--color-success-dim);
        color: var(--color-success);
        border-color: var(--color-success-border);
      }

      .pp-empty {
        color: var(--color-on-surface-variant);
        font-size: 0.875rem;
        text-align: center;
      }
    `,
  ],
})
export class ProductPreviewCardComponent {
  readonly session = input.required<MappingSessionService>();

  protected readonly canonicalFields = CANONICAL_FIELDS;

  protected readonly index = signal(0);
  protected readonly total = computed(() => this.session().extractedProducts().length);
  protected readonly product = computed<ProductRecord | null>(() => {
    const products = this.session().extractedProducts();
    return products[this.index()] ?? products[0] ?? null;
  });

  prev(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  next(): void {
    this.index.update((i) => Math.min(this.total() - 1, i + 1));
  }

  fieldValue(product: ProductRecord, key: string): string {
    const v = product[key];
    if (v === null || v === undefined) return '';
    return Array.isArray(v) ? String(v[0] ?? '') : String(v);
  }

  formattedPrice(product: ProductRecord): string {
    const v = product['precio'];
    if (typeof v === 'number') return `$${v.toFixed(2)}`;
    return this.fieldValue(product, 'precio') || '—';
  }

  imageUrl(product: ProductRecord): string | null {
    const v = product['imagen'];
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  hasValue(product: ProductRecord, key: string): boolean {
    const v = product[key];
    return v !== null && v !== undefined && v !== '';
  }

  matchedCount(product: ProductRecord): number {
    return this.canonicalFields.filter((f) => this.hasValue(product, f.key)).length;
  }
}
