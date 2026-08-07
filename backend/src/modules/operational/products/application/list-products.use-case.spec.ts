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

  it('uses default page=1 and limit=24 when no options are provided', async () => {
    const items = [Product.create({ id: 'p_1', title: 'X' })];
    repository.findAll.mockResolvedValue({ items, total: 1 });

    const result = await useCase.execute();

    expect(repository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 24,
      q: undefined,
    });
    expect(result).toEqual({ items, total: 1 });
  });

  it('forwards page, limit, and trimmed q (min 2 chars)', async () => {
    repository.findAll.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ page: 2, limit: 10, q: '  camisa  ' });

    expect(repository.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      q: 'camisa',
    });
  });

  it('ignores q if trimmed length < 2', async () => {
    repository.findAll.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ q: ' a ' });

    expect(repository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 24,
      q: undefined,
    });
  });

  it('findAllByDomainRule forwards the rule id', async () => {
    const products = [Product.create({ id: 'p_1', title: 'X' })];
    repository.findAllByDomainRule.mockResolvedValue(products);

    const result = await useCase.findAllByDomainRule('rule_a');

    expect(repository.findAllByDomainRule).toHaveBeenCalledWith('rule_a');
    expect(result).toBe(products);
  });
});
