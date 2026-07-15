import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product, Offer } from '../../../services/api.service';

/**
 * Product card component — Insight Flow variant.
 *
 * Renders a single product with its primary offer. Visual rules:
 *   - bg-surface / border-outline-variant, hover lifts border to
 *     --color-primary (per Insight Flow §Elevation).
 *   - Image container uses bg-surface-container-low.
 *   - Price color = --color-success (Insight Flow status chip).
 *   - Source badge uses bg-surface-container + text-label-caps.
 *   - Active state: border-primary + 2px ring via box-shadow.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <article
      class="block cursor-pointer overflow-hidden rounded-xl border border-outline-variant bg-surface transition-[border-color,box-shadow] duration-150 hover:border-primary"
      [class.border-primary]="isSelected()"
      [class.shadow-[0_0_0_2px_var(--color-primary)]]="isSelected()"
    >
      <div
        class="flex aspect-square items-center justify-center overflow-hidden bg-surface-container-low"
      >
        @if (imageUrl()) {
          <img
            [src]="imageUrl()"
            [alt]="title()"
            loading="lazy"
            class="size-full object-contain p-3"
          />
        } @else {
          <div class="text-on-surface-variant">
            <span class="material-symbols-outlined" style="font-size: 32px">image</span>
          </div>
        }
      </div>

      <div class="flex flex-col gap-2 p-4">
        <h3 class="text-body-md m-0 font-semibold leading-tight text-on-surface">
          <a
            class="text-inherit no-underline transition-colors hover:text-primary"
            [routerLink]="['/products', product().id]"
            (click)="$event.stopPropagation()"
          >
            {{ title() }}
          </a>
        </h3>

        <div class="flex flex-wrap items-center gap-2">
          <span class="text-body-lg font-bold text-success" [attr.data-currency]="currency()">
            {{ price() | currency: currency() : 'symbol' : '1.2-2' }}
          </span>
          @if (sourceId()) {
            <span
              class="rounded-xs bg-surface-container px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-on-surface-variant uppercase"
              [attr.data-source]="sourceId()"
            >
              {{ sourceId() }}
            </span>
          }
        </div>

        <div class="mt-1 flex flex-wrap gap-1.5">
          @if (offerCount() > 1) {
            <span
              class="rounded-full bg-primary-fixed px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-on-primary-container uppercase"
            >
              {{ offerCount() }} offers
            </span>
          }
          @if (hasHistory()) {
            <span
              class="rounded-full bg-success-dim px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-success uppercase"
            >
              Has history
            </span>
          }
        </div>
      </div>
    </article>
  `,
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