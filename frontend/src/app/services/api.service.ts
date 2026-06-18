import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ─── Interfaces ─────────────────────────────────────────────

export interface FieldMapping {
  canonicalField: string;
  selector: string;
  type: 'text' | 'attribute' | 'html';
  attribute?: string;
}

export interface DomainRule {
  id: string;
  domain: string;
  name: string;
  selectorTitle: string;
  selectorPrice: string;
  selectorImage?: string;
  selectorSku?: string;
  selectorType: string;
  sampleUrl?: string;
  lastScrapedAt?: string;
  createdAt: string;
  updatedAt: string;
  fieldMappings?: FieldMapping[];
  containerSelector?: string;
  productLimit?: number;
}

export interface ScrapingJob {
  id: string;
  domainRuleId: string;
  domainRule?: DomainRule;
  url: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  result?: any;
  enqueuedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  domainRuleId: string;
  domainRule?: DomainRule;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productUrl: string;
  sku?: string;
  description?: string;
  extractedAt: string;
  createdAt: string;
  updatedAt: string;
  priceHistory?: PriceHistory[];
}

export interface PriceHistory {
  id: string;
  productId: string;
  price: number;
  currency: string;
  capturedAt: string;
  createdAt: string;
}

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

  updateDomain(id: string, data: Partial<DomainRule>): Observable<DomainRule> {
    return this.http.patch<DomainRule>(`${this.baseUrl}/domains/${id}`, data);
  }

  // Scrape Listing
  scrapeListing(
    domainRuleId: string,
    url: string,
    limit?: number,
  ): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(
      `${this.baseUrl}/scrape-listing`,
      { domainRuleId, url, limit },
    );
  }

  // Scraping Jobs
  enqueueJob(domainRuleId: string, url: string): Observable<ScrapingJob> {
    return this.http.post<ScrapingJob>(`${this.baseUrl}/scraping-jobs`, { domainRuleId, url });
  }

  getJobs(status?: string, domainRuleId?: string): Observable<ScrapingJob[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    if (domainRuleId) params['domainRuleId'] = domainRuleId;
    return this.http.get<ScrapingJob[]>(`${this.baseUrl}/scraping-jobs`, { params });
  }

  getJobStatus(jobId: string): Observable<ScrapingJob> {
    return this.http.get<ScrapingJob>(`${this.baseUrl}/scraping-jobs/${jobId}`);
  }

  getJobResult(jobId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/scraping-jobs/${jobId}/result`);
  }

  // Products
  getProducts(includeHistory?: boolean): Observable<Product[]> {
    const params: Record<string, string> = {};
    if (includeHistory !== undefined) params['includeHistory'] = String(includeHistory);
    return this.http.get<Product[]>(`${this.baseUrl}/products`, { params });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  getPriceHistory(productId: string, from?: string, to?: string): Observable<PriceHistory[]> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<PriceHistory[]>(`${this.baseUrl}/products/${productId}/history`, { params });
  }
}
