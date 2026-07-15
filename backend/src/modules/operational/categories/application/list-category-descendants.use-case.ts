import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category.entity';
import { CategoryNotFoundError } from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Returns every descendant of a category ordered by materialized path
 * ascending (preserves the legacy controller ordering). Throws
 * `CategoryNotFoundError` when the id does not exist.
 */
@Injectable()
export class ListCategoryDescendantsUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(id: string): Promise<Category[]> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id);
    }
    return this.repository.findDescendants(id);
  }
}
