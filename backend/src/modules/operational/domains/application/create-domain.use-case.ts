import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainRule } from '../domain/domain.entity';
import type { DomainFieldMappings } from '../domain/domain.entity';
import { DomainCategoryNotFoundError } from '../domain/domain.errors';
import { DOMAINS_REPOSITORY } from '../domain/domains.repository';
import type {
  DomainRuleLoadResult,
  DomainsRepository,
} from '../domain/domains.repository';

export interface CreateDomainCommand {
  domain: string;
  name: string;
  categoryId?: string | null;
  fieldMappings: DomainFieldMappings;
  containerSelector?: string | null;
  productLimit?: number | null;
  sampleUrl?: string | null;
  paginationType?: 'scroll' | 'page-number';
  paginationSelector?: string | null;
}

/**
 * Creates a new DomainRule after enforcing the optional category FK.
 *
 * The category existence check runs before persistence so the failure
 * path stays in domain code (→ 404 `DomainCategoryNotFoundError`) instead
 * of leaking a Prisma P2003 through the global filter. Mirrors the legacy
 * `ensureCategoryExists` helper bit-for-bit.
 */
@Injectable()
export class CreateDomainUseCase {
  constructor(
    @Inject(DOMAINS_REPOSITORY)
    private readonly repository: DomainsRepository,
  ) {}

  async execute(command: CreateDomainCommand): Promise<DomainRuleLoadResult> {
    if (command.categoryId) {
      const exists = await this.repository.categoryExists(command.categoryId);
      if (!exists) {
        throw new DomainCategoryNotFoundError(command.categoryId);
      }
    }

    const rule = DomainRule.create({
      id: randomUUID(),
      domain: command.domain,
      name: command.name,
      categoryId: command.categoryId ?? null,
      fieldMappings: command.fieldMappings,
      containerSelector: command.containerSelector ?? null,
      productLimit: command.productLimit ?? null,
      sampleUrl: command.sampleUrl ?? null,
      paginationType: command.paginationType,
      paginationSelector: command.paginationSelector ?? null,
    });

    return this.repository.save(rule);
  }
}
