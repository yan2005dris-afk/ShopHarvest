import { ListCategoriesUseCase } from './list-categories.use-case';
import { Category } from '../domain/category.entity';
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

describe('ListCategoriesUseCase', () => {
  let useCase: ListCategoriesUseCase;
  let repository: ReturnType<typeof buildRepository>;

  beforeEach(() => {
    repository = buildRepository();
    useCase = new ListCategoriesUseCase(repository);
  });

  it('forwards the repository result untouched', async () => {
    const cats = [
      Category.fromPersistence({
        id: 'a',
        name: 'A',
        description: null,
        defaultFieldMappings: null,
        parentId: null,
        path: 'a',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
    repository.findAll.mockResolvedValue(cats);

    const result = await useCase.execute();
    expect(result).toBe(cats);
    expect(repository.findAll).toHaveBeenCalledTimes(1);
  });
});
