import { CreateBrandUseCase } from './create-brand.use-case';
import { Brand } from '../domain/brand.entity';
import { DuplicateBrandNameError } from '../domain/brand.errors';
import { BrandsRepository } from '../domain/brands.repository';

describe('CreateBrandUseCase', () => {
  let useCase: CreateBrandUseCase;
  let repository: jest.Mocked<BrandsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      fuzzyMatch: jest.fn(),
    };
    useCase = new CreateBrandUseCase(repository);
  });

  it('creates and persists a new brand with no aliases', async () => {
    repository.findByName.mockResolvedValue(null);
    repository.save.mockImplementation(async (b: Brand) => b);

    const result = await useCase.execute({ name: 'Samsung' });

    expect(repository.findByName).toHaveBeenCalledWith('Samsung');
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Samsung');
    expect(result.aliases).toEqual([]);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('persists provided aliases', async () => {
    repository.findByName.mockResolvedValue(null);
    repository.save.mockImplementation(async (b: Brand) => b);

    const result = await useCase.execute({
      name: 'Samsung',
      aliases: ['Sam', 'SSG'],
    });
    expect(result.aliases).toEqual(['Sam', 'SSG']);
  });

  it('throws DuplicateBrandNameError when name already exists', async () => {
    const existing = Brand.create({ id: 'brd_existing', name: 'Samsung' });
    repository.findByName.mockResolvedValue(existing);

    await expect(
      useCase.execute({ name: 'Samsung', aliases: [] }),
    ).rejects.toBeInstanceOf(DuplicateBrandNameError);

    expect(repository.save).not.toHaveBeenCalled();
  });
});
