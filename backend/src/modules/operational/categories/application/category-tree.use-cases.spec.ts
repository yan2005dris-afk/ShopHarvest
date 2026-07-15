import { ListCategoryAncestorsUseCase } from './list-category-ancestors.use-case';
import { ListCategoryDescendantsUseCase } from './list-category-descendants.use-case';
import { ListCategoryChildrenUseCase } from './list-category-children.use-case';
import { Category } from '../domain/category.entity';
import { CategoryNotFoundError } from '../domain/category.errors';
import type { CategoriesRepository } from '../domain/categories.repository';

const buildRepo = () =>
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

const fromRow = (id: string): Category =>
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

describe('ListCategoryAncestorsUseCase', () => {
  it('returns ancestors for a known id', async () => {
    const repository = buildRepo();
    repository.findById.mockResolvedValue(fromRow('cat_self'));
    const ancestors = [fromRow('a'), fromRow('b')];
    repository.findAncestors.mockResolvedValue(ancestors);
    const useCase = new ListCategoryAncestorsUseCase(repository);

    const result = await useCase.execute('cat_self');

    expect(result).toBe(ancestors);
    expect(repository.findAncestors).toHaveBeenCalledWith('cat_self');
  });

  it('throws CategoryNotFoundError when the id does not exist', async () => {
    const repository = buildRepo();
    repository.findById.mockResolvedValue(null);
    const useCase = new ListCategoryAncestorsUseCase(repository);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(repository.findAncestors).not.toHaveBeenCalled();
  });
});

describe('ListCategoryDescendantsUseCase', () => {
  it('returns descendants for a known id', async () => {
    const repository = buildRepo();
    repository.findById.mockResolvedValue(fromRow('cat_root'));
    const descendants = [fromRow('d1'), fromRow('d2')];
    repository.findDescendants.mockResolvedValue(descendants);
    const useCase = new ListCategoryDescendantsUseCase(repository);

    const result = await useCase.execute('cat_root');

    expect(result).toBe(descendants);
    expect(repository.findDescendants).toHaveBeenCalledWith('cat_root');
  });

  it('throws CategoryNotFoundError when the id does not exist', async () => {
    const repository = buildRepo();
    repository.findById.mockResolvedValue(null);
    const useCase = new ListCategoryDescendantsUseCase(repository);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(repository.findDescendants).not.toHaveBeenCalled();
  });
});

describe('ListCategoryChildrenUseCase', () => {
  it('returns children for a known id', async () => {
    const repository = buildRepo();
    repository.findById.mockResolvedValue(fromRow('cat_root'));
    const children = [fromRow('c1'), fromRow('c2')];
    repository.findChildren.mockResolvedValue(children);
    const useCase = new ListCategoryChildrenUseCase(repository);

    const result = await useCase.execute('cat_root');

    expect(result).toBe(children);
    expect(repository.findChildren).toHaveBeenCalledWith('cat_root');
  });

  it('throws CategoryNotFoundError when the id does not exist', async () => {
    const repository = buildRepo();
    repository.findById.mockResolvedValue(null);
    const useCase = new ListCategoryChildrenUseCase(repository);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(repository.findChildren).not.toHaveBeenCalled();
  });
});
