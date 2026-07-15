import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category.entity';
import { CategoryNotFoundError } from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Returns the direct children of a category ordered by name ascending.
 * Throws `CategoryNotFoundError` when the parent id does not exist,
 * matching the legacy `GET /:id/children` 404 contract.
 */
@Injectable()
export class ListCategoryChildrenUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(id: string): Promise<Category[]> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id);
    }
    return this.repository.findChildren(id);
  }
}
