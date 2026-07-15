import type {
  CategorySourceMapping as PrismaCategorySourceMapping,
  Source as PrismaSource,
} from '../../../../../generated/operational';
import type {
  CategorySourceMapping,
  CategorySourceMappingWithSource,
} from '../../domain/category-source-mappings.repository';

/**
 * Shape returned by Prisma when we include the `source` relation on a
 * category-source mapping. Kept private to the persistence layer so the
 * domain never imports Prisma types.
 */
type PrismaCategorySourceMappingWithSource = PrismaCategorySourceMapping & {
  source: PrismaSource;
};

export class CategorySourceMappingMapper {
  static toDomain(row: PrismaCategorySourceMapping): CategorySourceMapping {
    return {
      categoryId: row.categoryId,
      sourceId: row.sourceId,
      remoteCode: row.remoteCode,
    };
  }

  static toDomainWithSource(
    row: PrismaCategorySourceMappingWithSource,
  ): CategorySourceMappingWithSource {
    return {
      ...CategorySourceMappingMapper.toDomain(row),
      source: {
        id: row.source.id,
        code: row.source.code,
        name: row.source.name,
      },
    };
  }

  static toPersistence(mapping: CategorySourceMapping): {
    categoryId: string;
    sourceId: string;
    remoteCode: string;
  } {
    return {
      categoryId: mapping.categoryId,
      sourceId: mapping.sourceId,
      remoteCode: mapping.remoteCode,
    };
  }
}
