import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product, Offer } from '../../../services/api.service';

/**
 * Product card component.
 * Displays a single product with its primary offer (price, source, image).
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <article class="product-card" [class.product-card--selected]="isSelected()">
      <div class="product-card-image">
        @if (imageUrl()) {
          <img [src]="imageUrl()" [alt]="title()" loading="lazy" class="prd-img" />
        } @else {
          <div class="product-card-image-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        }
      </div>

      <div class="product-card-body">
        <h3 class="product-card-title">
          <a [routerLink]="['/products', product().id]" (click)="$event.stopPropagation()">
            {{ title() }}
          </a>
        </h3>

        <div class="product-card-meta">
          <span class="product-card-price" [attr.data-currency]="currency()">
            {{ price() | currency:currency():'symbol':'1.2-2' }}
          </span>
          @if (sourceId()) {
            <span class="product-card-source" [attr.data-source]="sourceId()">
              {{ sourceId() }}
            </span>
          }
        </div>

        <div class="product-card-badges">
          @if (offerCount() > 1) {
            <span class="badge badge--info">{{ offerCount() }} offers</span>
          }
          @if (hasHistory()) {
            <span class="badge badge--success">Has history</span>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .product-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .product-card:hover {
      border-color: var(--accent-border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .product-card--selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-dim);
    }
    .product-card-image {
      aspect-ratio: 1;
      background: var(--surface-2);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .product-card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 0.75rem;
    }
    .product-card-image-placeholder {
      color: var(--text-3);
    }
    .product-card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .product-card-title { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--text-1); line-height: 1.3; }
    .product-card-title a { color: inherit; text-decoration: none; }
    .product-card-title a:hover { color: var(--accent); }
    .product-card-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .product-card-price { font-weight: 700; font-size: 1rem; color: var(--success); }
    .product-card-source {
      font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-2); background: var(--surface-2);
      padding: 0.125rem 0.375rem; border-radius: var(--radius); font-family: var(--font-mono);
    }
    .product-card-badges { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-top: 0.25rem; }
    .badge {
      font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; padding: 0.125rem 0.375rem; border-radius: 999px;
    }
    .badge--info { background: var(--accent-dim); color: var(--accent); }
    .badge--success { background: var(--success-dim); color: var(--success); }
  `],
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly isSelected = input<boolean>(false);

  // Computed from product.offers[0] (primary offer)
  readonly primaryOffer = computed(() => this.product().offers[0]);

  readonly title = computed(() => this.product().title);
  readonly imageUrl = computed(() => this.product().imageUrl ?? null);
  readonly price = computed(() => Number(this.primaryOffer()?.price ?? 0));
  readonly currency = computed(() => this.primaryOffer()?.currency ?? 'USD');
  readonly sourceId = computed(() => this.primaryOffer()?.sourceId ?? null);
  readonly offerCount = computed(() => this.product().offers.length);
  readonly hasHistory = computed(() => false); // Price observations come from separate API
}