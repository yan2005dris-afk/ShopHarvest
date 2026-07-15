import { FindCategoryUseCase } from './find-category.use-case';
import { Category } from '../domain/category.entity';
import { CategoryNotFoundError } from '../domain/category.errors';
import type { CategoriesRepository } from '../domain/categories.repository';

const buildRepository = () =>
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

describe('FindCategoryUseCase', () => {
  let useCase: FindCategoryUseCase;
  let repository: ReturnType<typeof buildRepository>;

  beforeEach(() => {
    repository = buildRepository();
    useCase = new FindCategoryUseCase(repository);
  });

  it('returns the category when found', async () => {
    const cat = Category.fromPersistence({
      id: 'cat_1',
      name: 'X',
      description: null,
      defaultFieldMappings: null,
      parentId: null,
      path: 'cat_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.findById.mockResolvedValue(cat);

    const result = await useCase.execute('cat_1');
    expect(result).toBe(cat);
    expect(repository.findById).toHaveBeenCalledWith('cat_1');
  });

  it('throws CategoryNotFoundError when missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });
});
