import { CategoryResponseDto } from '@web-scraping/contracts/categories';
import type { CategorySourceMappingWithSource } from '../../domain/category-source-mappings.repository';
import { Category } from '../../domain/category.entity';

/**
 * Entity → HTTP DTO mapping.
 *
 * Mirrors the legacy `plainToInstance(CategoryResponseDto, row, {
 * excludeExtraneousValues: true })` shape so the wire contract is
 * unchanged. We return plain objects rather than class instances because
 * NestJS's serialization pipeline (validation pipe + global filter) does
 * not require DTO class instances, and the fields kept here line up
 * exactly with the `@Expose()` ones on the contract.
 */
export class CategoryResponseMapper {
  static toDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      defaultFieldMappings: category.defaultFieldMappings ?? undefined,
      parentId: category.parentId ?? undefined,
      path: category.path,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  /**
   * Maps a mapping row to the wire shape. The legacy controller returned
   * the raw Prisma row (including the full `source` object) — we keep
   * that exact surface here so existing consumers don't need to change.
   */
  static mappingToDto(
    mapping: CategorySourceMappingWithSource,
  ): Record<string, unknown> {
    return {
      categoryId: mapping.categoryId,
      sourceId: mapping.sourceId,
      remoteCode: mapping.remoteCode,
      ...(mapping.source
        ? {
            source: {
              id: mapping.source.id,
              code: mapping.source.code,
              name: mapping.source.name,
            },
          }
        : {}),
    };
  }
}
