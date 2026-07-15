import { Logger } from '@nestjs/common';
import { FindProductUseCase } from './find-product.use-case';
import { Product } from '../domain/product.entity';
import { ProductNotFoundError } from '../domain/product.errors';
import type { ProductsRepository } from '../domain/products.repository';

describe('FindProductUseCase', () => {
  let useCase: FindProductUseCase;
  let repository: jest.Mocked<ProductsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findAllByDomainRule: jest.fn(),
      findPriceHistory: jest.fn(),
      delete: jest.fn(),
      ingest: jest.fn(),
    };
    useCase = new FindProductUseCase(repository);
  });

  it('returns the loaded Product with default includeHistory=true', async () => {
    const product = Product.create({ id: 'p_1', title: 'X' });
    repository.findById.mockResolvedValue(product);

    const result = await useCase.execute('p_1');

    expect(repository.findById).toHaveBeenCalledWith('p_1', {
      includeHistory: true,
    });
    expect(result).toBe(product);
  });

  it('forwards an explicit options flag', async () => {
    const product = Product.create({ id: 'p_1', title: 'X' });
    repository.findById.mockResolvedValue(product);

    await useCase.execute('p_1', { includeHistory: false });

    expect(repository.findById).toHaveBeenCalledWith('p_1', {
      includeHistory: false,
    });
  });

  it('throws ProductNotFoundError when the repository returns null', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('p_missing')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it('does not call findById twice on the happy path', async () => {
    const product = Product.create({ id: 'p_1', title: 'X' });
    repository.findById.mockResolvedValue(product);

    await useCase.execute('p_1');
    expect(repository.findById).toHaveBeenCalledTimes(1);
  });

  it('Logger import side-effect (smoke)', () => {
    expect(Logger).toBeDefined();
  });
});
