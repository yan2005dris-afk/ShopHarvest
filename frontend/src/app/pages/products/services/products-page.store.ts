import { Injectable, computed, signal } from '@angular/core';
import { Product, Offer, PriceObservation } from '../../../services/api.service';

/**
 * Products page state management.
 * Centralizes all UI state for the products page.
 */
@Injectable({ providedIn: 'root' })
export class ProductsPageStore {
  // ─── Data ──────────────────────────────────────────────
  readonly products = signal<Product[]>([]);
  readonly filteredProducts = computed(() => {
    const term = this.searchTerm()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return this.products().filter((p) =>
      p.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(term),
    );
  });

  // ─── UI State ──────────────────────────────────────────
  readonly searchTerm = signal('');
  readonly selectedProduct = signal<Product | null>(null);
  readonly priceHistory = signal<PriceObservation[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  // ─── Derived ───────────────────────────────────────────
  readonly primaryOffer = (product: Product) => product.offers[0];

  /** Price history grouped by offerId for the selected product. */
  readonly historyByOffer = computed(() => {
    const history = this.priceHistory();
    const map = new Map<string, PriceObservation[]>();
    for (const obs of history) {
      const key = obs.offerId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(obs);
    }
    return map;
  });

  // ─── Actions ───────────────────────────────────────────
  setProducts(products: Product[]): void {
    this.products.set(products);
  }

  setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }

  setError(error: string | null): void {
    this.error.set(error);
  }

  selectProduct(product: Product | null): void {
    this.selectedProduct.set(product);
  }

  setPriceHistory(history: PriceObservation[]): void {
    this.priceHistory.set(history);
  }
}
