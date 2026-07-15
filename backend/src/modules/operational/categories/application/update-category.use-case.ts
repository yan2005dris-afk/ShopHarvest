import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category.entity';
import type { CategoryDefaultFieldMappings } from '../domain/category.entity';
import {
  CategoryCycleError,
  CategoryNotFoundError,
  CategorySelfReferenceError,
  ParentCategoryNotFoundError,
} from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';
import { wouldCreateCycle } from '../domain/tree-path';

export interface UpdateCategoryCommand {
  id: string;
  name?: string;
  description?: string | null;
  defaultFieldMappings?: CategoryDefaultFieldMappings | null;
  parentId?: string | null;
}

/**
 * Applies an update to a category, handling three sub-flows:
 *
 * 1. Plain field mutations (rename, description, defaultFieldMappings) →
 *    `category.update()` then `repository.save()`.
 * 2. Reparent — validated against self-reference, parent existence, and
 *    the cycle guard before delegating to `repository.reparent()` which
 *    owns the descendant-path rewrite transaction.
 * 3. Combined update + reparent — handled in one pass; the reparent
 *    repository method commits the path rewrite while the field changes
 *    ride along inside the same transaction.
 */
@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(command: UpdateCategoryCommand): Promise<Category> {
    const category = await this.repository.findById(command.id);
    if (!category) {
      throw new CategoryNotFoundError(command.id);
    }

    const reparents =
      command.parentId !== undefined && command.parentId !== category.parentId;

    if (reparents) {
      if (command.parentId === command.id) {
        throw new CategorySelfReferenceError(command.id);
      }

      if (command.parentId != null) {
        const newParentId = command.parentId;
        const newParent = await this.repository.findById(newParentId);
        if (!newParent) {
          throw new ParentCategoryNotFoundError(newParentId);
        }
        if (
          wouldCreateCycle(
            {
              id: category.id,
              parentId: category.parentId,
              path: category.path,
            },
            {
              id: newParent.id,
              parentId: newParent.parentId,
              path: newParent.path,
            },
          )
        ) {
          throw new CategoryCycleError();
        }
      }
    }

    category.update({
      name: command.name,
      description: command.description,
      defaultFieldMappings: command.defaultFieldMappings,
      parentId: command.parentId,
    });

    if (reparents) {
      // Pass the entity so its pending field mutations are persisted in
      // the same transaction that rewrites the descendant paths. Passing
      // only the id would lose name / description / defaultFieldMappings.
      return this.repository.reparent(category, command.parentId ?? null);
    }
    return this.repository.save(category);
  }
}
