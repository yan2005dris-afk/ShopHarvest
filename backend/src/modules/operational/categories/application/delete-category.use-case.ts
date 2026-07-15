import { Inject, Injectable } from '@nestjs/common';
import {
  CategoryHasChildrenError,
  CategoryNotFoundError,
} from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';

/**
 * Deletes a category by id, enforcing the legacy "no children" guard.
 *
 * The guard runs BEFORE the repository call so the failure path stays in
 * domain code: callers see `CategoryHasChildrenError` (→ 400) rather than
 * a database FK violation. The repository's `findChildren` is what the
 * legacy service got from `findUnique({ include: { children: true } })`.
 */
@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id);
    }

    const children = await this.repository.findChildren(id);
    if (children.length > 0) {
      throw new CategoryHasChildrenError(id, category.name, children.length);
    }

    await this.repository.delete(id);
  }
}
