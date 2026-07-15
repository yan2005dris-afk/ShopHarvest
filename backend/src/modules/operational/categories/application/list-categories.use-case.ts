import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category.entity';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Returns every persisted category. The repository decides ordering;
 * the legacy service returned rows ordered by `createdAt desc` and the
 * implementation preserves that.
 */
@Injectable()
export class ListCategoriesUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(): Promise<Category[]> {
    return this.repository.findAll();
  }
}
