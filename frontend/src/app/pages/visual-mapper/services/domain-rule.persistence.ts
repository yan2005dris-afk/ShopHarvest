import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, DomainRule } from '../../../services/api.service';
import type { ExtensionFieldMapping } from '../../../services/extension.service';

export interface SaveDomainRuleParams {
  hostname: string;
  pageTitle: string | null;
  fieldMappings: ExtensionFieldMapping[];
  containerSelector: string | null;
}

export interface SaveProductsParams {
  hostname: string;
  url: string;
  products: Record<string, unknown>[];
}

/**
 * Persistence layer for the Visual Mapper.
 * Encapsulates all API calls: create/update domain rule, ingest products,
 * and (future) schedule management.
 */
@Injectable({ providedIn: 'root' })
export class DomainRulePersistenceService {
  constructor(private readonly apiService: ApiService) {}

  /** Create or update a domain rule based on existing domains list. */
  saveDomainRule(
    params: SaveDomainRuleParams,
    existingDomains: DomainRule[],
  ): Observable<DomainRule> {
    const existing = existingDomains.find((d) => d.domain === params.hostname);
    const payload = {
      fieldMappings: params.fieldMappings,
      containerSelector: params.containerSelector ?? undefined,
    };

    if (existing) {
      return this.apiService.updateDomain(existing.id, payload);
    }
    return this.apiService.createDomain({
      domain: params.hostname,
      name: params.pageTitle || params.hostname,
      fieldMappings: params.fieldMappings,
      containerSelector: params.containerSelector ?? undefined,
    });
  }

  /** Ingest extracted products for a domain. */
  ingestProducts(params: SaveProductsParams): Observable<{ ingested: number; domainRuleId: string }> {
    return this.apiService.ingestProducts(params.hostname, params.url, params.products);
  }
}