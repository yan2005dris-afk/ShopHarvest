import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category.entity';
import { CategoryNotFoundError } from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Returns the category with the given id, throwing CategoryNotFoundError
 * when it does not exist. Used by HTTP handlers that target a specific
 * resource (`GET /:id`, `PATCH /:id`, `DELETE /:id`).
 */
@Injectable()
export class FindCategoryUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(id: string): Promise<Category> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id);
    }
    return category;
  }
}
