import { Inject, Injectable } from '@nestjs/common';
import type { CategorySourceMapping } from '../domain/category-source-mappings.repository';
import { CATEGORY_SOURCE_MAPPINGS_REPOSITORY } from '../domain/category-source-mappings.repository';
import type { CategorySourceMappingsRepository } from '../domain/category-source-mappings.repository';
import { CATEGORY_SOURCE_LOOKUP } from '../domain/category-source-lookup.repository';
import type { CategorySourceLookup } from '../domain/category-source-lookup.repository';
import { CATEGORIES_REPOSITORY } from '../domain/categories.repository';
import type { CategoriesRepository } from '../domain/categories.repository';
import {
  CategoryNotFoundError,
  DuplicateCategorySourceMappingError,
  SourceNotFoundError,
} from '../domain/category.errors';

export interface CreateCategorySourceMappingCommand {
  categoryId: string;
  sourceId: string;
  remoteCode: string;
}

/**
 * Creates a (categoryId, sourceId) → remoteCode mapping.
 *
 * Validation order matches the legacy service: category first, then source,
 * then duplicate check. The lookup ports keep the use case free of any
 * direct dependency on SourcesService or the Prisma `source` model.
 */
@Injectable()
export class CreateCategorySourceMappingUseCase {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly categoriesRepository: CategoriesRepository,
    @Inject(CATEGORY_SOURCE_MAPPINGS_REPOSITORY)
    private readonly mappingsRepository: CategorySourceMappingsRepository,
    @Inject(CATEGORY_SOURCE_LOOKUP)
    private readonly sourceLookup: CategorySourceLookup,
  ) {}

  async execute(
    command: CreateCategorySourceMappingCommand,
  ): Promise<CategorySourceMapping> {
    const category = await this.categoriesRepository.findById(
      command.categoryId,
    );
    if (!category) {
      throw new CategoryNotFoundError(command.categoryId);
    }

    if (!(await this.sourceLookup.sourceExists(command.sourceId))) {
      throw new SourceNotFoundError(command.sourceId);
    }

    const existing = await this.mappingsRepository.findByKey(
      command.categoryId,
      command.sourceId,
    );
    if (existing) {
      throw new DuplicateCategorySourceMappingError(
        command.categoryId,
        command.sourceId,
      );
    }

    return this.mappingsRepository.create({
      categoryId: command.categoryId,
      sourceId: command.sourceId,
      remoteCode: command.remoteCode,
    });
  }
}
