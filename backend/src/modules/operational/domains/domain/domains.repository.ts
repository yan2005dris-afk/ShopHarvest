import type { DomainRule } from './domain.entity';

/**
 * Enriched read result: a DomainRule aggregate plus the denormalized
 * category name needed by the response mapper.
 *
 * The legacy controller flattened `row.category.name` into a `categoryName`
 * field on the wire DTO. That denormalization is a JOIN projection — it
 * has no place inside the DomainRule aggregate itself — so the repository
 * returns both pieces and the response mapper stitches them together.
 *
 * Use cases expose this shape upstream so the HTTP layer does not need to
 * call a separate query for the joined name (which would risk N+1).
 */
export interface DomainRuleLoadResult {
  rule: DomainRule;
  categoryName: string | null;
}

/**
 * Port that the application layer uses to load and persist DomainRule
 * aggregates.
 *
 * Implemented in infrastructure/persistence/prisma-domains.repository.ts.
 * Use cases inject the symbol token `DOMAINS_REPOSITORY` and never see the
 * concrete class.
 */
export interface DomainsRepository {
  findAll(host?: string): Promise<DomainRuleLoadResult[]>;
  findById(id: string): Promise<DomainRuleLoadResult | null>;
  /**
   * Upsert-style save: creates the row if it does not exist, updates it
   * otherwise. The caller is responsible for generating the id (typically
   * via `randomUUID()` in the create use case). Returns the enriched
   * load result so the controller has the joined `categoryName` available.
   */
  save(rule: DomainRule): Promise<DomainRuleLoadResult>;
  delete(id: string): Promise<void>;
  /**
   * Existence check for the optional `categoryId` foreign key. Used by
   * the create/update use cases to surface a 404 before Prisma emits a
   * P2003. Keeps the failure path in domain code instead of relying on a
   * raw FK violation bubbling through the global filter.
   */
  categoryExists(categoryId: string): Promise<boolean>;
}

export const DOMAINS_REPOSITORY = Symbol('DomainsRepository');
