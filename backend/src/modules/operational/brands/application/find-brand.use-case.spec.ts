import { FindBrandUseCase } from './find-brand.use-case';
import { Brand } from '../domain/brand.entity';
import { BrandNotFoundError } from '../domain/brand.errors';
import { BrandsRepository } from '../domain/brands.repository';

describe('FindBrandUseCase', () => {
  let useCase: FindBrandUseCase;
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
    useCase = new FindBrandUseCase(repository);
  });

  it('returns the brand when found', async () => {
    const brand = Brand.create({ id: 'brd_1', name: 'Samsung' });
    repository.findById.mockResolvedValue(brand);

    const result = await useCase.execute('brd_1');
    expect(result).toBe(brand);
    expect(repository.findById).toHaveBeenCalledWith('brd_1');
  });

  it('throws BrandNotFoundError when missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      BrandNotFoundError,
    );
  });
});
