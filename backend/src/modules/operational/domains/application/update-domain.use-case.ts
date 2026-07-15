import { Inject, Injectable } from '@nestjs/common';
import { DomainRule } from '../domain/domain.entity';
import type { DomainFieldMappings } from '../domain/domain.entity';
import {
  DomainCategoryNotFoundError,
  DomainRuleNotFoundError,
} from '../domain/domain.errors';
import { DOMAINS_REPOSITORY } from '../domain/domains.repository';
import type {
  DomainRuleLoadResult,
  DomainsRepository,
} from '../domain/domains.repository';

export interface UpdateDomainCommand {
  id: string;
  domain?: string;
  name?: string;
  categoryId?: string | null;
  fieldMappings?: DomainFieldMappings | null;
  containerSelector?: string | null;
  productLimit?: number | null;
  sampleUrl?: string | null;
  paginationType?: 'scroll' | 'page-number';
  paginationSelector?: string | null;
}

/**
 * Applies a partial update to a DomainRule.
 *
 *  1. Loads the rule (404 if missing) so the mutators can run on a
 *     materialized aggregate.
 *  2. Validates the optional new `categoryId` (404 if missing) BEFORE
 *     any field change, so a bad FK never partially mutates state.
 *  3. Delegates the field mutation to the entity (no-op when undefined,
 *     clears when explicitly null) and persists the result.
 *
 * Pagination-related fields ride through `update()` exactly like the
 * legacy service's `...(dto.x !== undefined && { x: dto.x })` spread.
 */
@Injectable()
export class UpdateDomainUseCase {
  constructor(
    @Inject(DOMAINS_REPOSITORY)
    private readonly repository: DomainsRepository,
  ) {}

  async execute(command: UpdateDomainCommand): Promise<DomainRuleLoadResult> {
    const existing = await this.repository.findById(command.id);
    if (!existing) {
      throw new DomainRuleNotFoundError(command.id);
    }

    if (command.categoryId) {
      const exists = await this.repository.categoryExists(command.categoryId);
      if (!exists) {
        throw new DomainCategoryNotFoundError(command.categoryId);
      }
    }

    const rule: DomainRule = existing.rule;
    rule.update({
      domain: command.domain,
      name: command.name,
      categoryId: command.categoryId,
      fieldMappings: command.fieldMappings,
      containerSelector: command.containerSelector,
      productLimit: command.productLimit,
      sampleUrl: command.sampleUrl,
      paginationType: command.paginationType,
      paginationSelector: command.paginationSelector,
    });

    return this.repository.save(rule);
  }
}
