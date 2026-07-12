import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, DomainRule } from '../../../services/api.service';
import type { ExtensionFieldMapping } from '../../../services/extension.service';

export interface SaveDomainRuleParams {
  hostname: string;
  pageTitle: string | null;
  fieldMappings: ExtensionFieldMapping[];
  containerSelector: string | null;
  categoryId?: string;
}

export interface SaveProductsParams {
  hostname: string;
  url: string;
  products: Record<string, unknown>[];
  fieldMappings: ExtensionFieldMapping[];
  categoryId?: string;
}

/**
 * Persistence layer for the Visual Mapper.
 * Encapsulates all API calls: create/update domain rule, ingest products,
 * and (future) schedule management.
 */
@Injectable({ providedIn: 'root' })
export class DomainRulePersistenceService {
  private readonly apiService = inject(ApiService);

  /** Create or update a domain rule based on existing domains list. */
  saveDomainRule(
    params: SaveDomainRuleParams,
    existingDomains: DomainRule[],
  ): Observable<DomainRule> {
    const existing = existingDomains.find((d) => d.domain === params.hostname);

    if (existing) {
      const payload: Record<string, unknown> = {
        fieldMappings: params.fieldMappings,
        containerSelector: params.containerSelector ?? undefined,
      };
      if (params.categoryId) payload['categoryId'] = params.categoryId;
      return this.apiService.updateDomain(existing.id, payload);
    }
    return this.apiService.createDomain({
      domain: params.hostname,
      name: params.pageTitle || params.hostname,
      categoryId: params.categoryId,
      fieldMappings: params.fieldMappings,
      containerSelector: params.containerSelector ?? undefined,
    });
  }

  /** Ingest extracted products for a domain. */
  ingestProducts(params: SaveProductsParams): Observable<{ ingested: number; domainRuleId: string }> {
    return this.apiService.ingestProducts(params.hostname, params.url, params.products, params.fieldMappings, params.categoryId);
  }
}