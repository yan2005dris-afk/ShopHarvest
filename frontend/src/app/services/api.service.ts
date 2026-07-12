import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type {
  OfferResponseDto,
  PriceObservationResponseDto,
  ProductResponseDto,
} from '@web-scraping/contracts/products';
import type {
  DomainResponseDto,
  FieldMappingDto,
  UpdateDomainDto,
} from '@web-scraping/contracts/domains';
import type { ScrapeResult } from '@web-scraping/contracts/pipeline';
import type { ExtensionFieldMapping } from './extension.service';

// ─── Aliases — keep the existing call-site names so consumers don't
// have to change. The wire shape is owned by `@web-scraping/contracts`.
//
// `product-offer-split`: `Product` shrinks to canonical fields + `offers[]`
// (price/url/externalId moved onto `Offer`). `PriceHistory` is replaced by
// `PriceObservation`, keyed by `offerId` instead of `productId`.

export type DomainRule = DomainResponseDto;
export type FieldMapping = FieldMappingDto;
export type Product = ProductResponseDto;
export type Offer = OfferResponseDto;
export type PriceObservation = PriceObservationResponseDto;

// ─── ApiService ─────────────────────────────────────────────

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  // Domains
  getDomains(): Observable<DomainRule[]> {
    return this.http.get<DomainRule[]>(`${this.baseUrl}/domains`);
  }

  createDomain(data: Partial<DomainRule>): Observable<DomainRule> {
    return this.http.post<DomainRule>(`${this.baseUrl}/domains`, data);
  }

  updateDomain(id: string, data: UpdateDomainDto): Observable<DomainRule> {
    return this.http.patch<DomainRule>(`${this.baseUrl}/domains/${id}`, data);
  }

  // Pipeline
  getSources(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/pipeline/sources`);
  }

  scrapeSource(source: string, outputDir: string): Observable<ScrapeResult> {
    return this.http.post<ScrapeResult>(`${this.baseUrl}/pipeline/scrape/${source}`, { outputDir });
  }

  // Products
  ingestProducts(
    domain: string,
    pageUrl: string,
    products: Record<string, unknown>[],
    fieldMappings?: ExtensionFieldMapping[],
  ): Observable<{ ingested: number; domainRuleId: string }> {
    const body: Record<string, unknown> = { domain, pageUrl, products };
    if (fieldMappings && fieldMappings.length > 0) {
      body['fieldMappings'] = fieldMappings;
    }
    return this.http.post<{ ingested: number; domainRuleId: string }>(
      `${this.baseUrl}/products/ingest`,
      body,
    );
  }

  getProducts(includeHistory?: boolean): Observable<Product[]> {
    const params: Record<string, string> = {};
    if (includeHistory !== undefined) params['includeHistory'] = String(includeHistory);
    return this.http.get<Product[]>(`${this.baseUrl}/products`, { params });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  getPriceHistory(productId: string, from?: string, to?: string): Observable<PriceObservation[]> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<PriceObservation[]>(`${this.baseUrl}/products/${productId}/history`, {
      params,
    });
  }
}
