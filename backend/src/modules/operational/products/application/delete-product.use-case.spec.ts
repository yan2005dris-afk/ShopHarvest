import { DeleteProductUseCase } from './delete-product.use-case';
import { FindProductUseCase } from './find-product.use-case';
import { ProductNotFoundError } from '../domain/product.errors';
import type { ProductsRepository } from '../domain/products.repository';

describe('DeleteProductUseCase', () => {
  let remove: DeleteProductUseCase;
  let findProduct: jest.Mocked<FindProductUseCase>;
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
    findProduct = {
      execute: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<FindProductUseCase>;
    remove = new DeleteProductUseCase(repository, findProduct);
  });

  it('pre-checks the product with includeHistory=false, then deletes', async () => {
    await remove.execute('p_1');
    expect(findProduct.execute).toHaveBeenCalledWith('p_1', {
      includeHistory: false,
    });
    expect(repository.delete).toHaveBeenCalledWith('p_1');
  });

  it('does NOT delete when the pre-check throws', async () => {
    findProduct.execute.mockRejectedValue(
      new ProductNotFoundError('p_missing'),
    );

    await expect(remove.execute('p_missing')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
