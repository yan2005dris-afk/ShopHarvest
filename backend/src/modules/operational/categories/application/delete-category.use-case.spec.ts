import { DeleteCategoryUseCase } from './delete-category.use-case';
import { Category } from '../domain/category.entity';
import {
  CategoryHasChildrenError,
  CategoryNotFoundError,
} from '../domain/category.errors';
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

const fromRow = (
  overrides: Partial<{
    id: string;
    name: string;
    parentId: string | null;
    path: string;
  }>,
): Category =>
  Category.fromPersistence({
    id: overrides.id ?? 'cat_x',
    name: overrides.name ?? 'X',
    description: null,
    defaultFieldMappings: null,
    parentId: overrides.parentId ?? null,
    path: overrides.path ?? 'cat_x',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('DeleteCategoryUseCase', () => {
  let useCase: DeleteCategoryUseCase;
  let repository: ReturnType<typeof buildRepository>;

  beforeEach(() => {
    repository = buildRepository();
    useCase = new DeleteCategoryUseCase(repository);
  });

  it('deletes a leaf category', async () => {
    const cat = fromRow({ id: 'cat_1' });
    repository.findById.mockResolvedValue(cat);
    repository.findChildren.mockResolvedValue([]);

    await useCase.execute('cat_1');

    expect(repository.delete).toHaveBeenCalledWith('cat_1');
  });

  it('rejects deletion when the category has children', async () => {
    const cat = fromRow({ id: 'cat_parent', name: 'Parent' });
    repository.findById.mockResolvedValue(cat);
    repository.findChildren.mockResolvedValue([
      fromRow({ id: 'cat_child_a' }),
      fromRow({ id: 'cat_child_b' }),
    ]);

    await expect(useCase.execute('cat_parent')).rejects.toBeInstanceOf(
      CategoryHasChildrenError,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('throws CategoryNotFoundError when id does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
