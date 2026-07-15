import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, DomainRule, FieldMapping } from '../../../services/api.service';
import type { ExtensionFieldMapping } from '../../../services/extension.service';

/**
 * Mappings picked in extractAll mode carry `selector: ''` — there is no
 * real per-field CSS selector, the frontend picked a canonical name for
 * an already-auto-detected key (see MappingSessionService.selectFieldForMapping).
 * The backend's FieldMappingDto requires a non-empty selector, so an
 * empty string 400s the save. Mirrors the same placeholder used by
 * ApiService.ingestProducts and the extension's
 * EXTRACT_ALL_PLACEHOLDER_SELECTOR (extension/src/content/mapper.ts) —
 * keep those three in sync if this ever changes.
 */
const EXTRACT_ALL_PLACEHOLDER_SELECTOR = '[extractAll]';

function sanitizeFieldMappings(mappings: ExtensionFieldMapping[]): FieldMapping[] {
  return mappings.map((m) => ({
    canonicalField: m.canonicalField,
    selector: m.selector || EXTRACT_ALL_PLACEHOLDER_SELECTOR,
    type: m.type,
    attribute: m.attribute,
  }));
}

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
    const fieldMappings = sanitizeFieldMappings(params.fieldMappings);

    if (existing) {
      const payload: Record<string, unknown> = {
        fieldMappings,
        containerSelector: params.containerSelector ?? undefined,
      };
      if (params.categoryId) payload['categoryId'] = params.categoryId;
      return this.apiService.updateDomain(existing.id, payload);
    }
    return this.apiService.createDomain({
      domain: params.hostname,
      name: params.pageTitle || params.hostname,
      categoryId: params.categoryId,
      fieldMappings,
      containerSelector: params.containerSelector ?? undefined,
    });
  }

  /** Ingest extracted products for a domain. */
  ingestProducts(params: SaveProductsParams): Observable<{ ingested: number; domainRuleId: string }> {
    return this.apiService.ingestProducts(params.hostname, params.url, params.products, params.fieldMappings, params.categoryId);
  }
}