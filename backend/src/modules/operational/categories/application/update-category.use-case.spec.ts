import { UpdateCategoryUseCase } from './update-category.use-case';
import { Category } from '../domain/category.entity';
import {
  CategoryCycleError,
  CategoryNotFoundError,
  CategorySelfReferenceError,
  ParentCategoryNotFoundError,
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

describe('UpdateCategoryUseCase', () => {
  let useCase: UpdateCategoryUseCase;
  let repository: ReturnType<typeof buildRepository>;

  beforeEach(() => {
    repository = buildRepository();
    useCase = new UpdateCategoryUseCase(repository);
  });

  it('renames a category through the entity then save() (no reparent)', async () => {
    const cat = fromRow({ id: 'cat_1', name: 'Old' });
    repository.findById.mockResolvedValue(cat);
    repository.save.mockImplementation((c: Category) => Promise.resolve(c));

    const result = await useCase.execute({ id: 'cat_1', name: 'New' });

    expect(result.name).toBe('New');
    expect(repository.save).toHaveBeenCalledWith(cat);
    expect(repository.reparent).not.toHaveBeenCalled();
  });

  it('delegates to repository.reparent() when parentId changes', async () => {
    const cat = fromRow({
      id: 'cat_child',
      name: 'Child',
      parentId: 'cat_old_parent',
      path: 'cat_old_parent/cat_child',
    });
    const newParent = fromRow({
      id: 'cat_new_parent',
      name: 'NewParent',
      parentId: null,
      path: 'cat_new_parent',
    });
    repository.findById
      .mockResolvedValueOnce(cat)
      .mockResolvedValueOnce(newParent);
    repository.reparent.mockResolvedValue(
      fromRow({
        id: 'cat_child',
        name: 'Child',
        parentId: 'cat_new_parent',
        path: 'cat_new_parent/cat_child',
      }),
    );

    const result = await useCase.execute({
      id: 'cat_child',
      parentId: 'cat_new_parent',
    });

    expect(repository.reparent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cat_child', parentId: 'cat_new_parent' }),
      'cat_new_parent',
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(result.parentId).toBe('cat_new_parent');
    expect(result.path).toBe('cat_new_parent/cat_child');
  });

  it('passes the entity (with pending field mutations) to reparent when a combined update+reparent is requested', async () => {
    const cat = fromRow({
      id: 'cat_child',
      name: 'OldName',
      parentId: 'cat_old_parent',
      path: 'cat_old_parent/cat_child',
    });
    const newParent = fromRow({
      id: 'cat_new_parent',
      name: 'NewParent',
      parentId: null,
      path: 'cat_new_parent',
    });
    const newMappings = [
      { canonicalField: 'title', selector: 'h2', type: 'text' as const },
    ];
    repository.findById
      .mockResolvedValueOnce(cat)
      .mockResolvedValueOnce(newParent);
    repository.reparent.mockImplementation((c: Category) =>
      Promise.resolve(
        Category.fromPersistence({
          ...c.toJSON(),
          path: `${c.parentId}/${c.id}`,
        }),
      ),
    );

    const result = await useCase.execute({
      id: 'cat_child',
      name: 'NewName',
      description: 'Updated description',
      defaultFieldMappings: newMappings,
      parentId: 'cat_new_parent',
    });

    const [passedEntity, passedParentId] = repository.reparent.mock
      .calls[0] as unknown as [Category, string];
    expect(passedParentId).toBe('cat_new_parent');
    expect(passedEntity.name).toBe('NewName');
    expect(passedEntity.description).toBe('Updated description');
    expect(passedEntity.defaultFieldMappings).toEqual(newMappings);
    expect(passedEntity.parentId).toBe('cat_new_parent');
    expect(repository.save).not.toHaveBeenCalled();
    expect(result.name).toBe('NewName');
    expect(result.parentId).toBe('cat_new_parent');
  });

  it('rejects self-referencing parentId with CategorySelfReferenceError', async () => {
    const cat = fromRow({ id: 'cat_1' });
    repository.findById.mockResolvedValue(cat);

    await expect(
      useCase.execute({ id: 'cat_1', parentId: 'cat_1' }),
    ).rejects.toBeInstanceOf(CategorySelfReferenceError);

    expect(repository.reparent).not.toHaveBeenCalled();
  });

  it('rejects reparenting to a missing parent with ParentCategoryNotFoundError', async () => {
    const cat = fromRow({ id: 'cat_1' });
    repository.findById.mockResolvedValueOnce(cat).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ id: 'cat_1', parentId: 'cat_missing' }),
    ).rejects.toBeInstanceOf(ParentCategoryNotFoundError);

    expect(repository.reparent).not.toHaveBeenCalled();
  });

  it('rejects cycles with CategoryCycleError when new parent is a descendant', async () => {
    const cat = fromRow({
      id: 'cat_parent',
      name: 'P',
      parentId: null,
      path: 'cat_parent',
    });
    const descendant = fromRow({
      id: 'cat_child',
      name: 'C',
      parentId: 'cat_parent',
      path: 'cat_parent/cat_child',
    });
    repository.findById
      .mockResolvedValueOnce(cat)
      .mockResolvedValueOnce(descendant);

    await expect(
      useCase.execute({ id: 'cat_parent', parentId: 'cat_child' }),
    ).rejects.toBeInstanceOf(CategoryCycleError);

    expect(repository.reparent).not.toHaveBeenCalled();
  });

  it('allows reparenting to root (parentId: null)', async () => {
    const cat = fromRow({
      id: 'cat_1',
      parentId: 'cat_parent',
      path: 'cat_parent/cat_1',
    });
    repository.findById.mockResolvedValue(cat);
    repository.reparent.mockResolvedValue(
      fromRow({ id: 'cat_1', parentId: null, path: 'cat_1' }),
    );

    const result = await useCase.execute({ id: 'cat_1', parentId: null });

    expect(repository.reparent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cat_1', parentId: null }),
      null,
    );
    expect(result.parentId).toBeNull();
    expect(result.path).toBe('cat_1');
  });

  it('throws CategoryNotFoundError when id does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ id: 'missing', name: 'X' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.reparent).not.toHaveBeenCalled();
  });
});
