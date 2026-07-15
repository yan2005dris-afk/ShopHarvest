import { Inject, Injectable } from '@nestjs/common';
import { DomainRuleNotFoundError } from '../domain/domain.errors';
import { DOMAINS_REPOSITORY } from '../domain/domains.repository';
import type {
  DomainRuleLoadResult,
  DomainsRepository,
} from '../domain/domains.repository';

/**
 * Returns the DomainRule with the given id, throwing
 * `DomainRuleNotFoundError` when it does not exist. Used by the HTTP
 * handlers that target a specific resource (`GET /:id`, `PATCH /:id`,
 * `DELETE /:id`).
 */
@Injectable()
export class FindDomainUseCase {
  constructor(
    @Inject(DOMAINS_REPOSITORY)
    private readonly repository: DomainsRepository,
  ) {}

  async execute(id: string): Promise<DomainRuleLoadResult> {
    const result = await this.repository.findById(id);
    if (!result) {
      throw new DomainRuleNotFoundError(id);
    }
    return result;
  }
}
