import { GetPriceHistoryUseCase } from './get-price-history.use-case';
import { FindProductUseCase } from './find-product.use-case';
import { PriceObservation } from '../domain/price-observation.entity';
import { ProductNotFoundError } from '../domain/product.errors';
import type { ProductsRepository } from '../domain/products.repository';

describe('GetPriceHistoryUseCase', () => {
  let getHistory: GetPriceHistoryUseCase;
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
    getHistory = new GetPriceHistoryUseCase(repository, findProduct);
  });

  it('pre-checks the product with includeHistory=false (avoids joining twice)', async () => {
    repository.findPriceHistory.mockResolvedValue([]);

    await getHistory.execute('p_1');

    expect(findProduct.execute).toHaveBeenCalledWith('p_1', {
      includeHistory: false,
    });
  });

  it('returns the observations without an optional range', async () => {
    const obs = PriceObservation.create({
      id: 'po_1',
      offerId: 'o_1',
      price: 10,
      currency: 'USD',
    });
    repository.findPriceHistory.mockResolvedValue([obs]);

    const result = await getHistory.execute('p_1');

    expect(repository.findPriceHistory).toHaveBeenCalledWith('p_1', undefined);
    expect(result).toEqual([obs]);
  });

  it('forwards the date range when provided', async () => {
    repository.findPriceHistory.mockResolvedValue([]);

    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-31T00:00:00Z');
    await getHistory.execute('p_1', { from, to });

    expect(repository.findPriceHistory).toHaveBeenCalledWith('p_1', {
      from,
      to,
    });
  });

  it('propagates ProductNotFoundError from the pre-check', async () => {
    findProduct.execute.mockRejectedValue(
      new ProductNotFoundError('p_missing'),
    );

    await expect(getHistory.execute('p_missing')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(repository.findPriceHistory).not.toHaveBeenCalled();
  });
});
