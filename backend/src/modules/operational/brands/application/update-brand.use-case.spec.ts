import { UpdateBrandUseCase } from './update-brand.use-case';
import { Brand } from '../domain/brand.entity';
import {
  BrandNotFoundError,
  DuplicateBrandNameError,
} from '../domain/brand.errors';
import { BrandsRepository } from '../domain/brands.repository';

describe('UpdateBrandUseCase', () => {
  let useCase: UpdateBrandUseCase;
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
    useCase = new UpdateBrandUseCase(repository);
  });

  it('updates fields and persists the brand', async () => {
    const brand = Brand.create({
      id: 'brd_1',
      name: 'Old',
      aliases: ['A'],
    });
    repository.findById.mockResolvedValue(brand);
    repository.save.mockImplementation(async (b: Brand) => b);

    const result = await useCase.execute({
      id: 'brd_1',
      name: 'New',
      aliases: ['B', 'C'],
    });

    expect(result.name).toBe('New');
    expect(result.aliases).toEqual(['B', 'C']);
    expect(repository.save).toHaveBeenCalledWith(brand);
  });

  it('does not consult findByName when the name is unchanged', async () => {
    const brand = Brand.create({ id: 'brd_1', name: 'Same' });
    repository.findById.mockResolvedValue(brand);
    repository.save.mockImplementation(async (b: Brand) => b);

    await useCase.execute({ id: 'brd_1', name: 'Same', aliases: ['x'] });
    expect(repository.findByName).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('throws DuplicateBrandNameError when renaming onto an existing name', async () => {
    const brand = Brand.create({ id: 'brd_1', name: 'Old' });
    const conflict = Brand.create({ id: 'brd_2', name: 'New' });
    repository.findById.mockResolvedValue(brand);
    repository.findByName.mockResolvedValue(conflict);

    await expect(
      useCase.execute({ id: 'brd_1', name: 'New' }),
    ).rejects.toBeInstanceOf(DuplicateBrandNameError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows renaming to a free name', async () => {
    const brand = Brand.create({ id: 'brd_1', name: 'Old' });
    repository.findById.mockResolvedValue(brand);
    repository.findByName.mockResolvedValue(null);
    repository.save.mockImplementation(async (b: Brand) => b);

    const result = await useCase.execute({ id: 'brd_1', name: 'Free' });
    expect(result.name).toBe('Free');
  });

  it('throws BrandNotFoundError when id does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ id: 'missing', name: 'X' }),
    ).rejects.toBeInstanceOf(BrandNotFoundError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
