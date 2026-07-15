import { CreateCategoryUseCase } from './create-category.use-case';
import { Category } from '../domain/category.entity';
import { ParentCategoryNotFoundError } from '../domain/category.errors';
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

describe('CreateCategoryUseCase', () => {
  let useCase: CreateCategoryUseCase;
  let repository: ReturnType<typeof buildRepository>;

  beforeEach(() => {
    repository = buildRepository();
    useCase = new CreateCategoryUseCase(repository);
  });

  it('creates a root category whose path equals the freshly minted id', async () => {
    repository.save.mockImplementation((c: Category) => Promise.resolve(c));

    const result = await useCase.execute({ name: 'Electronics' });

    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.parentId).toBeNull();
    // The id is a UUID minted inside the use case; the path mirrors it.
    expect(result.path).toBe(result.id);
    expect(result.name).toBe('Electronics');
  });

  it('composes the child path from the parent path and the child id', async () => {
    const parent = Category.fromPersistence({
      id: 'cat_parent',
      name: 'Parent',
      description: null,
      defaultFieldMappings: null,
      parentId: null,
      path: 'cat_parent',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.findById.mockResolvedValue(parent);
    repository.save.mockImplementation((c: Category) => Promise.resolve(c));

    const result = await useCase.execute({
      name: 'Child',
      parentId: 'cat_parent',
    });

    expect(repository.findById).toHaveBeenCalledWith('cat_parent');
    expect(result.parentId).toBe('cat_parent');
    expect(result.path).toBe(`cat_parent/${result.id}`);
  });

  it('throws ParentCategoryNotFoundError when parentId does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ name: 'Child', parentId: 'cat_missing' }),
    ).rejects.toBeInstanceOf(ParentCategoryNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('persists optional description and field mappings on the new entity', async () => {
    repository.save.mockImplementation((c: Category) => Promise.resolve(c));

    const result = await useCase.execute({
      name: 'X',
      description: 'desc',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: 'h1', type: 'text' },
      ],
    });

    expect(result.description).toBe('desc');
    expect(result.defaultFieldMappings).toEqual([
      { canonicalField: 'title', selector: 'h1', type: 'text' },
    ]);
  });
});
