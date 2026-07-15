/**
 * Port the application layer uses to manage Category ↔ Source mappings.
 *
 * Separated from `CategoriesRepository` (per the established
 * three-segregated-port convention) so that a use case like
 * `RemoveMappingUseCase` only depends on the mapping port, not on the
 * full categories aggregate. The source-existence lookup port keeps
 * validation from leaking `SourcesService` references into the use case.
 */
export interface CategorySourceMappingProps {
  categoryId: string;
  sourceId: string;
  remoteCode: string;
}

export interface CategorySourceMappingWithSourceProps extends CategorySourceMappingProps {
  source: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface CategorySourceMapping {
  categoryId: string;
  sourceId: string;
  remoteCode: string;
}

export interface CategorySourceMappingWithSource extends CategorySourceMapping {
  source: { id: string; code: string; name: string } | null;
}

export interface CategorySourceMappingsRepository {
  findByKey(
    categoryId: string,
    sourceId: string,
  ): Promise<CategorySourceMapping | null>;
  findByCategory(
    categoryId: string,
  ): Promise<CategorySourceMappingWithSource[]>;
  create(input: CategorySourceMapping): Promise<CategorySourceMapping>;
  delete(categoryId: string, sourceId: string): Promise<void>;
}

export const CATEGORY_SOURCE_MAPPINGS_REPOSITORY = Symbol(
  'CategorySourceMappingsRepository',
);
