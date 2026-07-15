import { Inject, Injectable } from '@nestjs/common';
import type { CategorySourceMappingWithSource } from '../domain/category-source-mappings.repository';
import { CATEGORY_SOURCE_MAPPINGS_REPOSITORY } from '../domain/category-source-mappings.repository';
import type { CategorySourceMappingsRepository } from '../domain/category-source-mappings.repository';
import { CategoryNotFoundError } from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Returns every mapping attached to a category, including the lightweight
 * source projection (`id`/`code`/`name`) the legacy controller returned.
 * Throws `CategoryNotFoundError` when the category id does not exist.
 */
@Injectable()
export class ListCategorySourceMappingsUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly categoriesRepository: CategoriesRepository,
    @Inject(CATEGORY_SOURCE_MAPPINGS_REPOSITORY)
    private readonly mappingsRepository: CategorySourceMappingsRepository,
  ) {}

  async execute(
    categoryId: string,
  ): Promise<CategorySourceMappingWithSource[]> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new CategoryNotFoundError(categoryId);
    }
    return this.mappingsRepository.findByCategory(categoryId);
  }
}
