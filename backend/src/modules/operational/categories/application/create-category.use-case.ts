import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Category } from '../domain/category.entity';
import type { CategoryDefaultFieldMappings } from '../domain/category.entity';
import { ParentCategoryNotFoundError } from '../domain/category.errors';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';
import { buildCategoryPath } from '../domain/tree-path';

export interface CreateCategoryCommand {
  name: string;
  description?: string | null;
  parentId?: string | null;
  defaultFieldMappings?: CategoryDefaultFieldMappings | null;
}

/**
 * Creates a new category and computes its materialized path.
 *
 * The repository owns the path assignment for child nodes because it needs
 * to read the parent's path before we can compose the child's. For root
 * nodes the path collapses to the freshly minted self id.
 */
@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<Category> {
    let parentPath = '';
    if (command.parentId) {
      const parent = await this.repository.findById(command.parentId);
      if (!parent) {
        throw new ParentCategoryNotFoundError(command.parentId);
      }
      parentPath = parent.path;
    }

    const id = randomUUID();
    const parentId = command.parentId ?? null;
    const category = Category.create({
      id,
      name: command.name,
      description: command.description ?? null,
      defaultFieldMappings: command.defaultFieldMappings ?? null,
      parentId,
    });

    category.assignPath(buildCategoryPath(parentPath, id, parentId));
    return this.repository.save(category);
  }
}
