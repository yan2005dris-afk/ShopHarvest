import type {
  Category as PrismaCategory,
  DomainRule as PrismaDomainRule,
} from '../../../../../generated/operational';
import { DomainRule } from '../../domain/domain.entity';
import type {
  DomainFieldMappings,
  DomainRuleProps,
} from '../../domain/domain.entity';
import type { DomainPaginationType } from '@web-scraping/contracts/domains';

/**
 * Shape returned by Prisma when we include the `category` relation on a
 * DomainRule. Kept private to the persistence layer so the domain never
 * imports Prisma types.
 */
export type PrismaDomainRuleWithCategory = PrismaDomainRule & {
  category?: Pick<PrismaCategory, 'id' | 'name'> | null;
};

/**
 * Maps a Prisma `domain_rules` row to a DomainRule domain entity and back.
 *
 * The `fieldMappings` JSON column can legitimately be null, an empty array,
 * or a populated array of `FieldMappingDto`. We round-trip it through the
 * `toDomainFieldMappings` helper which narrows to `DomainFieldMappings |
 * null`. The mapper is the single point where the JSON narrowing happens —
 * domain code and use cases only ever see `DomainFieldMappings | null`.
 */
export class DomainMapper {
  static toDomain(row: PrismaDomainRule): DomainRule {
    const props: DomainRuleProps = {
      id: row.id,
      domain: row.domain,
      name: row.name,
      categoryId: row.categoryId,
      fieldMappings: DomainMapper.toDomainFieldMappings(row.fieldMappings),
      containerSelector: row.containerSelector,
      productLimit: row.productLimit,
      sampleUrl: row.sampleUrl,
      paginationType: row.paginationType as DomainPaginationType,
      paginationSelector: row.paginationSelector,
      lastScrapedAt: row.lastScrapedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return DomainRule.fromPersistence(props);
  }

  /**
   * Extract the denormalized category name from the JOIN result. Returns
   * `null` when the rule has no category (legacy behavior — the
   * `categoryName` field is omitted from the response DTO).
   */
  static categoryNameFromRow(row: PrismaDomainRuleWithCategory): string | null {
    return row.category?.name ?? null;
  }

  /**
   * Round-trip helper for tests. Returns the raw field-mapping array
   * (or null) exactly as it should land on the Prisma `fieldMappings`
   * JSON column.
   */
  static fieldMappingsToPersistence(
    mappings: DomainFieldMappings | null,
  ): unknown {
    if (mappings === null) return null;
    return mappings.map((mapping) => ({
      canonicalField: mapping.canonicalField,
      selector: mapping.selector,
      type: mapping.type,
      ...(mapping.attribute === undefined
        ? {}
        : { attribute: mapping.attribute }),
    }));
  }

  private static toDomainFieldMappings(
    raw: unknown,
  ): DomainFieldMappings | null {
    if (raw === null || raw === undefined) return null;
    if (!Array.isArray(raw)) return null;
    return raw as DomainFieldMappings;
  }
}
