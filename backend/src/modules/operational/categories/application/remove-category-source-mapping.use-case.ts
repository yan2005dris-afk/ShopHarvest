import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_SOURCE_MAPPINGS_REPOSITORY } from '../domain/category-source-mappings.repository';
import type { CategorySourceMappingsRepository } from '../domain/category-source-mappings.repository';
import { CategorySourceMappingNotFoundError } from '../domain/category.errors';

/**
 * Removes a (categoryId, sourceId) mapping.
 *
 * The legacy service threw `NotFoundException` when the row was missing;
 * we surface that as `CategorySourceMappingNotFoundError` so the HTTP
 * adapter can map it to 404 without leaking framework types into the
 * application layer.
 */
@Injectable()
export class RemoveCategorySourceMappingUseCase {
  constructor(
    @Inject(CATEGORY_SOURCE_MAPPINGS_REPOSITORY)
    private readonly mappingsRepository: CategorySourceMappingsRepository,
  ) {}

  async execute(categoryId: string, sourceId: string): Promise<void> {
    const existing = await this.mappingsRepository.findByKey(
      categoryId,
      sourceId,
    );
    if (!existing) {
      throw new CategorySourceMappingNotFoundError(categoryId, sourceId);
    }
    await this.mappingsRepository.delete(categoryId, sourceId);
  }
}
