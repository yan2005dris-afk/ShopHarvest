import type { DomainResponseDto } from '@web-scraping/contracts/domains';
import type { DomainRuleLoadResult } from '../../domain/domains.repository';

/**
 * Entity → HTTP DTO mapping.
 *
 * Mirrors the legacy `plainToInstance(DomainResponseDto, row, {
 * excludeExtraneousValues: true })` shape so the wire contract is
 * unchanged: `categoryName` is populated from the JOIN projection
 * carried on `DomainRuleLoadResult.categoryName`, and the
 * `fieldMappings` array rides along from the entity.
 *
 * Returns a plain object — NestJS's serialization pipeline (validation
 * pipe + global filter) does not require DTO class instances, and the
 * fields kept here line up exactly with the `@Expose()` ones on the
 * contract.
 */
export class DomainResponseMapper {
  static toDto(load: DomainRuleLoadResult): DomainResponseDto {
    const rule = load.rule;
    return {
      id: rule.id,
      domain: rule.domain,
      name: rule.name,
      categoryId: rule.categoryId ?? undefined,
      categoryName: load.categoryName ?? undefined,
      containerSelector: rule.containerSelector ?? undefined,
      productLimit: rule.productLimit ?? undefined,
      sampleUrl: rule.sampleUrl ?? undefined,
      lastScrapedAt: rule.lastScrapedAt
        ? rule.lastScrapedAt.toISOString()
        : undefined,
      paginationType: rule.paginationType,
      paginationSelector: rule.paginationSelector ?? undefined,
      fieldMappings: rule.fieldMappings ?? undefined,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
