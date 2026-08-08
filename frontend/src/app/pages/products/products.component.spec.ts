import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductsComponent } from './products.component';

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

if (typeof globalThis.MutationObserver === 'undefined') {
  (globalThis as any).MutationObserver = class {
    constructor(_cb: any) {}
    observe(): void {}
    disconnect(): void {}
    takeRecords(): any[] {
      return [];
    }
  };
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('ProductsComponent (offer-level model)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  function productFixture(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'p1',
      title: 'Zapatilla Nike',
      description: null,
      imageUrl: null,
      categoryId: null,
      brandId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      offers: [
        {
          id: 'o1',
          productId: 'p1',
          sourceId: 's1',
          url: 'https://temu.com/x',
          price: 29.99,
          currency: 'USD',
          extractedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'o2',
          productId: 'p1',
          sourceId: 's2',
          url: 'https://shein.com/y',
          price: 24.5,
          currency: 'USD',
          extractedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      ...overrides,
    };
  }

  it("renders one row per Offer, with each offer's own price/url (no flat product.price)", () => {
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/sources' && r.method === 'GET').flush([]);

    const req = httpMock.expectOne((r) => r.url === '/api/products' && r.method === 'GET');
    req.flush({
      data: [productFixture()],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.selectProduct(component.products[0]);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/products/p1/history').flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const offerRows = host.querySelectorAll('[data-testid="offer-row"]');
    expect(offerRows).toHaveLength(2);
    expect(offerRows[0].textContent).toContain('29.99');
    expect(offerRows[1].textContent).toContain('24.5');
  });

  it("resolves each offer's sourceId to the source's name instead of showing the raw uuid", () => {
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/sources' && r.method === 'GET')
      .flush([
        { id: 's1', code: 'TEMU', name: 'Temu', baseUrl: 'https://temu.com', status: 'active' },
      ]);

    httpMock
      .expectOne((r) => r.url === '/api/products' && r.method === 'GET')
      .flush({
        data: [productFixture()],
        meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
      });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.selectProduct(component.products[0]);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/products/p1/history').flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const offerRows = host.querySelectorAll('[data-testid="offer-row"]');
    expect(offerRows[0].textContent).toContain('Temu');
    expect(offerRows[0].textContent).not.toContain('s1');
    expect(offerRows[1].textContent).toContain('s2');
  });

  it('requests price history by productId and attributes each observation to its own Offer', () => {
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/sources' && r.method === 'GET').flush([]);

    const listReq = httpMock.expectOne((r) => r.url === '/api/products' && r.method === 'GET');
    listReq.flush({
      data: [productFixture()],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.selectProduct(component.products[0]);
    fixture.detectChanges();

    const historyReq = httpMock.expectOne(
      (r) => r.url === '/api/products/p1/history' && r.method === 'GET',
    );
    historyReq.flush([
      {
        id: 'po1',
        offerId: 'o1',
        price: 29.99,
        currency: 'USD',
        observedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'po2',
        offerId: 'o2',
        price: 24.5,
        currency: 'USD',
        observedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    expect(component.historyForOffer('o1')).toHaveLength(1);
    expect(component.historyForOffer('o1')[0].price).toBe(29.99);
    expect(component.historyForOffer('o2')).toHaveLength(1);
    expect(component.historyForOffer('o2')[0].price).toBe(24.5);

    const host = fixture.nativeElement as HTMLElement;
    const historyGroups = host.querySelectorAll('[data-testid="history-group"]');
    expect(historyGroups).toHaveLength(2);

    expect((historyGroups[0] as HTMLDetailsElement).open).toBe(true);
    expect((historyGroups[1] as HTMLDetailsElement).open).toBe(false);
  });

  it('collapses the selection (and clears price history) when the same product is clicked twice', () => {
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/sources' && r.method === 'GET').flush([]);

    const listReq = httpMock.expectOne((r) => r.url === '/api/products' && r.method === 'GET');
    listReq.flush({
      data: [productFixture()],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.selectProduct(component.products[0]);
    fixture.detectChanges();

    const historyReq = httpMock.expectOne(
      (r) => r.url === '/api/products/p1/history' && r.method === 'GET',
    );
    historyReq.flush([]);
    fixture.detectChanges();

    component.selectProduct(component.products[0]);
    fixture.detectChanges();

    expect(component.selectedProduct).toBeNull();
    expect(component.priceHistory).toEqual([]);
  });

  it('closes the detail overlay on Escape, matching ConfirmModal', () => {
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/sources' && r.method === 'GET').flush([]);

    const listReq = httpMock.expectOne((r) => r.url === '/api/products' && r.method === 'GET');
    listReq.flush({
      data: [productFixture()],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.selectProduct(component.products[0]);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/products/p1/history').flush([]);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.selectedProduct).toBeNull();
  });

  it('Escape is a no-op when no product is selected', () => {
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/sources' && r.method === 'GET').flush([]);
    httpMock
      .expectOne((r) => r.url === '/api/products' && r.method === 'GET')
      .flush({
        data: [],
        meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ).not.toThrow();
    expect(fixture.componentInstance.selectedProduct).toBeNull();
  });
});
