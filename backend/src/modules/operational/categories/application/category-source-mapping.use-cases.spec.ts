import { CreateCategorySourceMappingUseCase } from './create-category-source-mapping.use-case';
import { ListCategorySourceMappingsUseCase } from './list-category-source-mappings.use-case';
import { RemoveCategorySourceMappingUseCase } from './remove-category-source-mapping.use-case';
import { Category } from '../domain/category.entity';
import type {
  CategorySourceMapping,
  CategorySourceMappingsRepository,
  CategorySourceMappingWithSource,
} from '../domain/category-source-mappings.repository';
import {
  CategoryNotFoundError,
  CategorySourceMappingNotFoundError,
  DuplicateCategorySourceMappingError,
  SourceNotFoundError,
} from '../domain/category.errors';
import type { CategoriesRepository } from '../domain/categories.repository';
import type { CategorySourceLookup } from '../domain/category-source-lookup.repository';

const buildCategoriesRepo = () =>
  ({
    findAll: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findChildren: jest.fn(),
    findAncestors: jest.fn(),
    findDescendants: jest.fn(),
    reparent: jest.fn(),
  }) satisfies jest.Mocked<CategoriesRepository>;

const buildMappingsRepo = () =>
  ({
    findByKey: jest.fn(),
    findByCategory: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  }) satisfies jest.Mocked<CategorySourceMappingsRepository>;

const buildLookup = () =>
  ({
    sourceExists: jest.fn(),
  }) satisfies jest.Mocked<CategorySourceLookup>;

const aCategory = (id: string): Category =>
  Category.fromPersistence({
    id,
    name: id,
    description: null,
    defaultFieldMappings: null,
    parentId: null,
    path: id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('CreateCategorySourceMappingUseCase', () => {
  let categoriesRepo: ReturnType<typeof buildCategoriesRepo>;
  let mappingsRepo: ReturnType<typeof buildMappingsRepo>;
  let lookup: ReturnType<typeof buildLookup>;
  let useCase: CreateCategorySourceMappingUseCase;

  beforeEach(() => {
    categoriesRepo = buildCategoriesRepo();
    mappingsRepo = buildMappingsRepo();
    lookup = buildLookup();
    useCase = new CreateCategorySourceMappingUseCase(
      categoriesRepo,
      mappingsRepo,
      lookup,
    );
    categoriesRepo.findById.mockResolvedValue(aCategory('cat_1'));
    lookup.sourceExists.mockResolvedValue(true);
    mappingsRepo.findByKey.mockResolvedValue(null);
  });

  it('creates the mapping when category and source exist', async () => {
    const created: CategorySourceMapping = {
      categoryId: 'cat_1',
      sourceId: 'src_1',
      remoteCode: 'remote-123',
    };
    mappingsRepo.create.mockResolvedValue(created);

    const result = await useCase.execute({
      categoryId: 'cat_1',
      sourceId: 'src_1',
      remoteCode: 'remote-123',
    });

    expect(result).toBe(created);
    expect(mappingsRepo.create).toHaveBeenCalledWith({
      categoryId: 'cat_1',
      sourceId: 'src_1',
      remoteCode: 'remote-123',
    });
  });

  it('throws CategoryNotFoundError when the category does not exist', async () => {
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        categoryId: 'cat_missing',
        sourceId: 'src_1',
        remoteCode: 'x',
      }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);

    expect(lookup.sourceExists).not.toHaveBeenCalled();
    expect(mappingsRepo.create).not.toHaveBeenCalled();
  });

  it('throws SourceNotFoundError when the source does not exist', async () => {
    lookup.sourceExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        categoryId: 'cat_1',
        sourceId: 'src_missing',
        remoteCode: 'x',
      }),
    ).rejects.toBeInstanceOf(SourceNotFoundError);

    expect(mappingsRepo.findByKey).not.toHaveBeenCalled();
    expect(mappingsRepo.create).not.toHaveBeenCalled();
  });

  it('throws DuplicateCategorySourceMappingError when the mapping already exists', async () => {
    mappingsRepo.findByKey.mockResolvedValue({
      categoryId: 'cat_1',
      sourceId: 'src_1',
      remoteCode: 'old',
    });

    await expect(
      useCase.execute({
        categoryId: 'cat_1',
        sourceId: 'src_1',
        remoteCode: 'new',
      }),
    ).rejects.toBeInstanceOf(DuplicateCategorySourceMappingError);

    expect(mappingsRepo.create).not.toHaveBeenCalled();
  });
});

describe('ListCategorySourceMappingsUseCase', () => {
  let categoriesRepo: ReturnType<typeof buildCategoriesRepo>;
  let mappingsRepo: ReturnType<typeof buildMappingsRepo>;
  let useCase: ListCategorySourceMappingsUseCase;

  beforeEach(() => {
    categoriesRepo = buildCategoriesRepo();
    mappingsRepo = buildMappingsRepo();
    useCase = new ListCategorySourceMappingsUseCase(
      categoriesRepo,
      mappingsRepo,
    );
  });

  it('returns mappings with source projection when category exists', async () => {
    categoriesRepo.findById.mockResolvedValue(aCategory('cat_1'));
    const rows: CategorySourceMappingWithSource[] = [
      {
        categoryId: 'cat_1',
        sourceId: 'src_1',
        remoteCode: 'r',
        source: { id: 'src_1', code: 'C', name: 'N' },
      },
    ];
    mappingsRepo.findByCategory.mockResolvedValue(rows);

    const result = await useCase.execute('cat_1');
    expect(result).toBe(rows);
    expect(mappingsRepo.findByCategory).toHaveBeenCalledWith('cat_1');
  });

  it('throws CategoryNotFoundError when the category does not exist', async () => {
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(mappingsRepo.findByCategory).not.toHaveBeenCalled();
  });
});

describe('RemoveCategorySourceMappingUseCase', () => {
  let mappingsRepo: ReturnType<typeof buildMappingsRepo>;
  let useCase: RemoveCategorySourceMappingUseCase;

  beforeEach(() => {
    mappingsRepo = buildMappingsRepo();
    useCase = new RemoveCategorySourceMappingUseCase(mappingsRepo);
  });

  it('deletes an existing mapping', async () => {
    mappingsRepo.findByKey.mockResolvedValue({
      categoryId: 'cat_1',
      sourceId: 'src_1',
      remoteCode: 'r',
    });

    await useCase.execute('cat_1', 'src_1');

    expect(mappingsRepo.delete).toHaveBeenCalledWith('cat_1', 'src_1');
  });

  it('throws CategorySourceMappingNotFoundError when missing', async () => {
    mappingsRepo.findByKey.mockResolvedValue(null);

    await expect(useCase.execute('cat_1', 'src_1')).rejects.toBeInstanceOf(
      CategorySourceMappingNotFoundError,
    );
    expect(mappingsRepo.delete).not.toHaveBeenCalled();
  });
});
