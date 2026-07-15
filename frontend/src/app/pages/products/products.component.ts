import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, Offer, PriceObservation } from '../../services/api.service';
import { ProductsPageStore } from './services/products-page.store';
import { PriceHistoryChartComponent } from './components/price-history-chart.component';
import { ProductCardComponent } from './components/product-card.component';
import { SkeletonComponent } from 'boneyard-js/angular';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink, FormsModule, PriceHistoryChartComponent, ProductCardComponent, SkeletonComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  protected readonly store = inject(ProductsPageStore);

  protected isLoadingHistory = signal(false);

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.store.setLoading(true);
    this.store.setError(null);
    this.apiService.getProducts(true).subscribe({
      next: (products) => {
        this.store.setProducts(products);
        this.store.setLoading(false);
      },
      error: (err) => {
        this.store.setLoading(false);
        this.store.setError('Error al cargar productos. Verificá que el backend esté funcionando.');
        console.error('Failed to load products', err);
      },
    });
  }

  // ── Public store delegates (for template + test access) ──

  /** All loaded products (from store). */
  get products(): Product[] {
    return this.store.products();
  }

  /** Currently selected product or null. */
  get selectedProduct(): Product | null {
    return this.store.selectedProduct();
  }

  /** Loaded price observations. */
  get priceHistory(): PriceObservation[] {
    return this.store.priceHistory();
  }

  /** Primary offer for a product (first offer — price, url, source for card summary). */
  protected primaryOffer(product: Product): Offer | undefined {
    return product.offers[0];
  }

  /** Select a product and load its price history. */
  selectProduct(product: Product): void {
    if (this.store.selectedProduct()?.id === product.id) {
      this.store.selectProduct(null);
      return;
    }

    this.store.selectProduct(product);
    this.store.setPriceHistory([]);
    this.loadPriceHistory(product.id);
  }

  /** Price observations for one specific `Offer` within the selected product. */
  historyForOffer(offerId: string): PriceObservation[] {
    return this.store.historyByOffer().get(offerId) ?? [];
  }

  private loadPriceHistory(productId: string): void {
    this.isLoadingHistory.set(true);
    this.apiService.getPriceHistory(productId).subscribe({
      next: (history) => {
        this.store.setPriceHistory(history);
        this.isLoadingHistory.set(false);
      },
      error: (err) => {
        console.error('Failed to load price history', err);
        this.isLoadingHistory.set(false);
      },
    });
  }

  trackByProductId(index: number, product: Product): string {
    return product.id;
  }

  trackByOfferId(index: number, offer: Offer): string {
    return offer.id;
  }
}