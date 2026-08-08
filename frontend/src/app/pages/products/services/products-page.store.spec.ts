import { TestBed } from '@angular/core/testing';
import { ProductsPageStore } from './products-page.store';
import type { Product } from '../../../services/api.service';

const buildProduct = (id: string, title: string): Product => ({
  id,
  title,
  description: undefined,
  imageUrl: undefined,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  offers: [
    {
      id: `o_${id}`,
      productId: id,
      sourceId: 's_1',
      domainRuleId: undefined,
      url: 'https://example.com',
      currency: 'USD',
      price: 10,
      sku: undefined,
      extractedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

describe('ProductsPageStore', () => {
  let store: ProductsPageStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductsPageStore],
    });
    store = TestBed.inject(ProductsPageStore);
  });

  it('sets initial products and pagination metadata', () => {
    const products = [buildProduct('p1', 'Product 1')];
    store.setProducts(products, { page: 1, limit: 24, total: 50, totalPages: 3 });

    expect(store.products()).toEqual(products);
    expect(store.page()).toBe(1);
    expect(store.total()).toBe(50);
    expect(store.totalPages()).toBe(3);
    expect(store.hasMore()).toBe(true);
  });

  it('appends products and deduplicates by product id', () => {
    const page1 = [buildProduct('p1', 'P1'), buildProduct('p2', 'P2')];
    store.setProducts(page1, { page: 1, limit: 2, total: 4, totalPages: 2 });

    const page2WithDup = [buildProduct('p2', 'P2 Duplicate'), buildProduct('p3', 'P3')];
    store.appendProducts(page2WithDup, { page: 2, limit: 2, total: 4, totalPages: 2 });

    expect(store.products()).toHaveLength(3);
    expect(store.products().map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(store.page()).toBe(2);
    expect(store.hasMore()).toBe(false);
  });

  it('handles isLoadingMore and loadMoreError state', () => {
    expect(store.isLoadingMore()).toBe(false);
    expect(store.loadMoreError()).toBeNull();

    store.setIsLoadingMore(true);
    expect(store.isLoadingMore()).toBe(true);

    store.setLoadMoreError('Network failed');
    expect(store.loadMoreError()).toBe('Network failed');
  });
});
