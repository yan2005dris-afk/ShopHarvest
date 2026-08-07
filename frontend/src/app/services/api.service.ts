import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type {
  OfferResponseDto,
  PriceObservationResponseDto,
  ProductResponseDto,
  ProductListResponseDto,
  PaginationMetaDto,
} from '@web-scraping/contracts/products';
import type {
  DomainResponseDto,
  FieldMappingDto,
  UpdateDomainDto,
} from '@web-scraping/contracts/domains';
import type {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@web-scraping/contracts/categories';
import type { SourceResponseDto } from '@web-scraping/contracts/sources';
import type { ScrapeResult } from '@web-scraping/contracts/pipeline';
import type { ExtensionFieldMapping } from './extension.service';
import { environment } from '../../environments/environment';

export type DomainRule = DomainResponseDto;
export type FieldMapping = FieldMappingDto;
export type Product = ProductResponseDto;
export type ProductListResponse = ProductListResponseDto;
export type PaginationMeta = PaginationMetaDto;
export type Offer = OfferResponseDto;
export type PriceObservation = PriceObservationResponseDto;
export type Category = CategoryResponseDto;
export type Source = SourceResponseDto;

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

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

  listSources(): Observable<Source[]> {
    return this.http.get<Source[]>(`${this.baseUrl}/sources`);
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
    categoryId?: string,
  ): Observable<{ ingested: number; domainRuleId: string }> {
    const body: Record<string, unknown> = { domain, pageUrl, products };
    if (fieldMappings && fieldMappings.length > 0) {
      const dtoMappings: FieldMappingDto[] = fieldMappings.map((m) => ({
        canonicalField: m.canonicalField,
        selector: m.selector || '[extractAll]',
        type: m.type,
        attribute: m.attribute,
      }));
      body['fieldMappings'] = dtoMappings;
    }
    if (categoryId) body['categoryId'] = categoryId;
    return this.http.post<{ ingested: number; domainRuleId: string }>(
      `${this.baseUrl}/products/ingest`,
      body,
    );
  }

  // ── Categories ──────────────────────────────────────────────

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`);
  }

  createCategory(data: CreateCategoryDto): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/categories`, data);
  }

  updateCategory(id: string, data: UpdateCategoryDto): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/categories/${id}`);
  }

  getProducts(query?: {
    page?: number;
    limit?: number;
    q?: string;
  }): Observable<ProductListResponseDto> {
    const params: Record<string, string> = {};
    if (query?.page !== undefined) params['page'] = String(query.page);
    if (query?.limit !== undefined) params['limit'] = String(query.limit);
    if (query?.q !== undefined && query.q.trim() !== '') params['q'] = query.q.trim();
    return this.http.get<ProductListResponseDto>(`${this.baseUrl}/products`, { params });
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
