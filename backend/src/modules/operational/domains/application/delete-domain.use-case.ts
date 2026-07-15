import { Inject, Injectable } from '@nestjs/common';
import { DomainRuleNotFoundError } from '../domain/domain.errors';
import { DOMAINS_REPOSITORY } from '../domain/domains.repository';
import type { DomainsRepository } from '../domain/domains.repository';

/**
 * Deletes a DomainRule by id, throwing `DomainRuleNotFoundError` if the
 * row does not exist. Mirrors the legacy service's pre-check so the 404
 * path stays in domain code instead of leaking a Prisma P2025.
 */
@Injectable()
export class DeleteDomainUseCase {
  constructor(
    @Inject(DOMAINS_REPOSITORY)
    private readonly repository: DomainsRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new DomainRuleNotFoundError(id);
    }
    await this.repository.delete(id);
  }
}
