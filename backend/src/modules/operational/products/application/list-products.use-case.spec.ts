import { ListProductsUseCase } from './list-products.use-case';
import { Product } from '../domain/product.entity';
import type { ProductsRepository } from '../domain/products.repository';

describe('ListProductsUseCase', () => {
  let useCase: ListProductsUseCase;
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
    useCase = new ListProductsUseCase(repository);
  });

  it('passes includeHistory=true when none is provided (legacy default)', async () => {
    const products = [Product.create({ id: 'p_1', title: 'X' })];
    repository.findAll.mockResolvedValue(products);

    const result = await useCase.execute();

    expect(repository.findAll).toHaveBeenCalledWith({ includeHistory: true });
    expect(result).toBe(products);
  });

  it('forwards an explicit includeHistory=false', async () => {
    repository.findAll.mockResolvedValue([]);
    await useCase.execute(false);
    expect(repository.findAll).toHaveBeenCalledWith({ includeHistory: false });
  });

  it('findAllByDomainRule forwards the rule id', async () => {
    const products = [Product.create({ id: 'p_1', title: 'X' })];
    repository.findAllByDomainRule.mockResolvedValue(products);

    const result = await useCase.findAllByDomainRule('rule_a');

    expect(repository.findAllByDomainRule).toHaveBeenCalledWith('rule_a');
    expect(result).toBe(products);
  });
});
