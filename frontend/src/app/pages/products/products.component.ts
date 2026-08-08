import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, skip, switchMap } from 'rxjs';

import { ApiService, Product, Offer, PriceObservation } from '../../services/api.service';
import { ProductsPageStore } from './services/products-page.store';
import { PriceHistoryChartComponent } from './components/price-history-chart.component';
import { ProductCardComponent } from './components/product-card.component';
import { IntersectionObserverDirective } from '../../shared/directives/intersection-observer.directive';
import { SkeletonComponent } from 'boneyard-js/angular';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyPipe,
    RouterLink,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    PriceHistoryChartComponent,
    ProductCardComponent,
    IntersectionObserverDirective,
    SkeletonComponent,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(ProductsPageStore);

  protected isLoadingHistory = signal(false);

  private readonly searchPipe$ = toObservable(this.store.searchTerm).pipe(
    skip(1),
    debounceTime(300),
    distinctUntilChanged(),
    filter((t) => t.length === 0 || t.length >= 2),
    switchMap((term) => {
      this.store.setLoading(true);
      this.store.setError(null);
      return this.apiService.getProducts({ page: 1, limit: 24, q: term || undefined });
    }),
    takeUntilDestroyed(),
  );

  constructor() {
    this.searchPipe$.subscribe({
      next: (res) => {
        this.store.setProducts(res.data, res.meta);
        this.store.setLoading(false);
        this.openProductFromRoute(res.data);
      },
      error: (err) => {
        this.store.setLoading(false);
        this.store.setError('Error al buscar productos. Verificá que el backend esté funcionando.');
        console.error('Failed search query', err);
      },
    });
  }

  ngOnInit(): void {
    this.loadSources();
    this.fetchPage(1, this.store.searchTerm(), false);
  }

  fetchPage(page: number, q?: string, append = false): void {
    if (append) {
      if (this.store.isLoadingMore() || !this.store.hasMore()) return;
      this.store.setIsLoadingMore(true);
      this.store.setLoadMoreError(null);
    } else {
      this.store.setLoading(true);
      this.store.setError(null);
    }

    this.apiService.getProducts({ page, limit: 24, q: q || undefined }).subscribe({
      next: (res) => {
        if (append) {
          this.store.appendProducts(res.data, res.meta);
          this.store.setIsLoadingMore(false);
        } else {
          this.store.setProducts(res.data, res.meta);
          this.store.setLoading(false);
          this.openProductFromRoute(res.data);
        }
      },
      error: (err) => {
        if (append) {
          this.store.setIsLoadingMore(false);
          this.store.setLoadMoreError('Error al cargar más productos.');
        } else {
          this.store.setLoading(false);
          this.store.setError(
            'Error al cargar productos. Verificá que el backend esté funcionando.',
          );
        }
        console.error('Failed to fetch page', err);
      },
    });
  }

  loadMore(): void {
    if (this.store.isLoadingMore() || !this.store.hasMore()) return;
    this.fetchPage(this.store.page() + 1, this.store.searchTerm(), true);
  }

  retryLoadMore(): void {
    this.loadMore();
  }

  private loadSources(): void {
    this.apiService.listSources().subscribe({
      next: (sources) => this.store.setSources(sources),
      error: (err) => console.error('Failed to load sources', err),
    });
  }

  private openProductFromRoute(loadedProducts: Product[]): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const product = loadedProducts.find((p) => p.id === id);
    if (product) {
      this.selectProduct(product);
    } else {
      this.apiService.getProduct(id).subscribe({
        next: (p) => this.selectProduct(p),
        error: (err) => console.error('Failed to load deep-linked product', err),
      });
    }
  }

  // ── Public store delegates ──

  get products(): Product[] {
    return this.store.products();
  }

  get selectedProduct(): Product | null {
    return this.store.selectedProduct();
  }

  get priceHistory(): PriceObservation[] {
    return this.store.priceHistory();
  }

  protected primaryOffer(product: Product): Offer | undefined {
    return product.offers[0];
  }

  protected sourceName(sourceId: string): string {
    return this.store.sourceName(sourceId);
  }

  selectProduct(product: Product): void {
    if (this.store.selectedProduct()?.id === product.id) {
      this.store.selectProduct(null);
      return;
    }

    this.store.selectProduct(product);
    this.store.setPriceHistory([]);
    this.loadPriceHistory(product.id);
  }

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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.store.selectedProduct()) {
      this.store.selectProduct(null);
    }
  }

  trackByProductId(index: number, product: Product): string {
    return product.id;
  }

  trackByOfferId(index: number, offer: Offer): string {
    return offer.id;
  }
}
