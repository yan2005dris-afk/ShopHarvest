import { Injectable, computed, signal } from '@angular/core';
import type { Product, PriceObservation, Source, PaginationMeta } from '../../../services/api.service';

/**
 * Products page state management.
 * Centralizes all UI state for the products page, including server-side pagination & infinite scroll.
 */
@Injectable({ providedIn: 'root' })
export class ProductsPageStore {
  // ─── Data ──────────────────────────────────────────────
  readonly products = signal<Product[]>([]);
  readonly sources = signal<Source[]>([]);

  // ─── Pagination & Async State ──────────────────────────
  readonly page = signal<number>(1);
  readonly limit = signal<number>(24);
  readonly total = signal<number>(0);
  readonly totalPages = signal<number>(0);
  readonly isLoadingMore = signal<boolean>(false);
  readonly loadMoreError = signal<string | null>(null);

  /** Whether there are more pages available on the server. */
  readonly hasMore = computed(() => {
    return this.page() < this.totalPages() && this.products().length < this.total();
  });

  /** Offer.sourceId → Source.name, so the UI never shows a raw UUID. */
  readonly sourceNameById = computed(() => new Map(this.sources().map((s) => [s.id, s.name])));

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

  /** Resolved source name for an offer, falling back to the raw id if unknown/unloaded. */
  sourceName(sourceId: string): string {
    return this.sourceNameById().get(sourceId) ?? sourceId;
  }

  // ─── Actions ───────────────────────────────────────────
  /**
   * Sets the initial/replaced list of products from page 1 response.
   */
  setProducts(products: Product[], meta?: PaginationMeta): void {
    this.products.set(products);
    if (meta) {
      this.page.set(meta.page);
      this.limit.set(meta.limit);
      this.total.set(meta.total);
      this.totalPages.set(meta.totalPages);
    }
  }

  /**
   * Appends a new page of products, de-duplicating by product ID to tolerate offset drift.
   */
  appendProducts(newProducts: Product[], meta: PaginationMeta): void {
    const existingIds = new Set(this.products().map((p) => p.id));
    const uniqueIncoming = newProducts.filter((p) => !existingIds.has(p.id));
    this.products.update((prev) => [...prev, ...uniqueIncoming]);

    this.page.set(meta.page);
    this.limit.set(meta.limit);
    this.total.set(meta.total);
    this.totalPages.set(meta.totalPages);
    this.loadMoreError.set(null);
  }

  setSources(sources: Source[]): void {
    this.sources.set(sources);
  }

  setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }

  setIsLoadingMore(loadingMore: boolean): void {
    this.isLoadingMore.set(loadingMore);
  }

  setError(error: string | null): void {
    this.error.set(error);
  }

  setLoadMoreError(error: string | null): void {
    this.loadMoreError.set(error);
  }

  selectProduct(product: Product | null): void {
    this.selectedProduct.set(product);
  }

  setPriceHistory(history: PriceObservation[]): void {
    this.priceHistory.set(history);
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }
}
