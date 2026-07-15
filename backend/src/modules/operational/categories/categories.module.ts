import { Module } from '@nestjs/common';
import { CreateCategoryUseCase } from './application/create-category.use-case';
import { CreateCategorySourceMappingUseCase } from './application/create-category-source-mapping.use-case';
import { DeleteCategoryUseCase } from './application/delete-category.use-case';
import { FindCategoryUseCase } from './application/find-category.use-case';
import { ListCategoriesUseCase } from './application/list-categories.use-case';
import { ListCategoryAncestorsUseCase } from './application/list-category-ancestors.use-case';
import { ListCategoryChildrenUseCase } from './application/list-category-children.use-case';
import { ListCategoryDescendantsUseCase } from './application/list-category-descendants.use-case';
import { ListCategorySourceMappingsUseCase } from './application/list-category-source-mappings.use-case';
import { RemoveCategorySourceMappingUseCase } from './application/remove-category-source-mapping.use-case';
import { UpdateCategoryUseCase } from './application/update-category.use-case';
import { CATEGORY_SOURCE_MAPPINGS_REPOSITORY } from './domain/category-source-mappings.repository';
import { CATEGORY_SOURCE_LOOKUP } from './domain/category-source-lookup.repository';
import { CATEGORIES_REPOSITORY } from './domain/categories.repository';
import { CategoriesHttpController } from './infrastructure/http/categories-http.controller';
import { PrismaCategoriesRepository } from './infrastructure/persistence/prisma-categories.repository';
import { PrismaCategorySourceLookup } from './infrastructure/persistence/prisma-category-source-lookup.repository';
import { PrismaCategorySourceMappingsRepository } from './infrastructure/persistence/prisma-category-source-mappings.repository';

@Module({
  controllers: [CategoriesHttpController],
  providers: [
    PrismaCategoriesRepository,
    { provide: CATEGORIES_REPOSITORY, useExisting: PrismaCategoriesRepository },
    PrismaCategorySourceMappingsRepository,
    {
      provide: CATEGORY_SOURCE_MAPPINGS_REPOSITORY,
      useExisting: PrismaCategorySourceMappingsRepository,
    },
    PrismaCategorySourceLookup,
    {
      provide: CATEGORY_SOURCE_LOOKUP,
      useExisting: PrismaCategorySourceLookup,
    },
    CreateCategoryUseCase,
    FindCategoryUseCase,
    ListCategoriesUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    ListCategoryAncestorsUseCase,
    ListCategoryDescendantsUseCase,
    ListCategoryChildrenUseCase,
    CreateCategorySourceMappingUseCase,
    ListCategorySourceMappingsUseCase,
    RemoveCategorySourceMappingUseCase,
  ],
  exports: [
    CATEGORIES_REPOSITORY,
    CATEGORY_SOURCE_MAPPINGS_REPOSITORY,
    CATEGORY_SOURCE_LOOKUP,
    CreateCategoryUseCase,
    FindCategoryUseCase,
    ListCategoriesUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    ListCategoryAncestorsUseCase,
    ListCategoryDescendantsUseCase,
    ListCategoryChildrenUseCase,
    CreateCategorySourceMappingUseCase,
    ListCategorySourceMappingsUseCase,
    RemoveCategorySourceMappingUseCase,
  ],
})
export class CategoriesModule {}
