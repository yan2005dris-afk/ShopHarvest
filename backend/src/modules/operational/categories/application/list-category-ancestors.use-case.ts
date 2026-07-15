import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category.entity';
import { CategoryNotFoundError } from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Returns the ancestor chain for a category, ordered root → leaf.
 * Throws `CategoryNotFoundError` when the id does not exist, matching
 * the legacy `GET /:id/ancestors` 404 contract.
 */
@Injectable()
export class ListCategoryAncestorsUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(id: string): Promise<Category[]> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id);
    }
    return this.repository.findAncestors(id);
  }
}
