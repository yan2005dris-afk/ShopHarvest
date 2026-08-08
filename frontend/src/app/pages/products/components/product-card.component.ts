import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Product } from '../../../services/api.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, MatIconModule, MatChipsModule],
  template: `
    <article
      class="block cursor-pointer overflow-hidden rounded-xl border border-outline-variant bg-surface transition-[border-color,box-shadow] duration-150 hover:border-primary font-sans"
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
            <mat-icon class="!size-8 !text-3xl">image</mat-icon>
          </div>
        }
      </div>

      <div class="flex flex-col gap-2 p-4">
        <h3 class="text-body-md m-0 font-semibold leading-tight text-on-surface">
          <span class="text-inherit transition-colors hover:text-primary">
            {{ title() }}
          </span>
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
              {{ sourceLabel() }}
            </span>
          }
        </div>

        <div class="mt-1 flex flex-wrap gap-1.5">
          @if (offerCount() > 1) {
            <mat-chip-set>
              <mat-chip class="!min-h-6 !text-[11px] font-bold uppercase">
                {{ offerCount() }} offers
              </mat-chip>
            </mat-chip-set>
          }
          @if (hasHistory()) {
            <mat-chip-set>
              <mat-chip class="!min-h-6 !text-[11px] font-bold uppercase text-success">
                Has history
              </mat-chip>
            </mat-chip-set>
          }
        </div>
      </div>
    </article>
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly isSelected = input<boolean>(false);
  /** Offer.sourceId → Source.name, passed down from the page store. */
  readonly sourceNames = input<Map<string, string>>(new Map());

  // Computed from product.offers[0] (primary offer)
  readonly primaryOffer = computed(() => this.product().offers[0]);

  readonly title = computed(() => this.product().title);
  readonly imageUrl = computed(() => this.product().imageUrl ?? null);
  readonly price = computed(() => Number(this.primaryOffer()?.price ?? 0));
  readonly currency = computed(() => this.primaryOffer()?.currency ?? 'USD');
  readonly sourceId = computed(() => this.primaryOffer()?.sourceId ?? null);
  /** Human-readable source name; falls back to the raw id if unresolved. */
  readonly sourceLabel = computed(() => {
    const id = this.sourceId();
    return id ? (this.sourceNames().get(id) ?? id) : null;
  });
  readonly offerCount = computed(() => this.product().offers.length);
  readonly hasHistory = computed(() => false); // Price observations come from separate API
}
