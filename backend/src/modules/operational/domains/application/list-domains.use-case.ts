import { Inject, Injectable } from '@nestjs/common';
import { DOMAINS_REPOSITORY } from '../domain/domains.repository';
import type {
  DomainRuleLoadResult,
  DomainsRepository,
} from '../domain/domains.repository';

/**
 * Returns every persisted DomainRule. The optional `host` filter mirrors
 * the legacy `?host=` query parameter: the extension looks up the saved
 * rule for the current page so the batch-5 auto-replay scheduler can read
 * its scroll configuration without an extra roundtrip.
 */
@Injectable()
export class ListDomainsUseCase {
  constructor(
    @Inject(DOMAINS_REPOSITORY)
    private readonly repository: DomainsRepository,
  ) {}

  async execute(host?: string): Promise<DomainRuleLoadResult[]> {
    return this.repository.findAll(host);
  }
}
