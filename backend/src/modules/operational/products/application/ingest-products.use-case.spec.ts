import { Logger } from '@nestjs/common';
import { IngestProductsUseCase } from './ingest-products.use-case';
import type { IngestCommand, ProductsRepository } from '../domain/products.repository';

describe('IngestProductsUseCase', () => {
  let useCase: IngestProductsUseCase;
  let repository: jest.Mocked<ProductsRepository>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findAllByDomainRule: jest.fn(),
      findPriceHistory: jest.fn(),
      delete: jest.fn(),
      ingest: jest.fn().mockResolvedValue({ ingested: 0, domainRuleId: '' }),
    };
    useCase = new IngestProductsUseCase(repository);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('maps an inbound product to a canonical item using field mappings', async () => {
    await useCase.execute({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    expect(repository.ingest).toHaveBeenCalledTimes(1);
    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.domain).toBe('temu.com');
    expect(command.pageUrl).toBe('https://temu.com/list');
    expect(command.items).toHaveLength(1);
    expect(command.items[0].title).toBe('Zapatilla Nike');
    expect(command.items[0].price).toBe(29.99);
    expect(command.items[0].currency).toBe('USD');
    expect(command.items[0].url).toBe('https://temu.com/list#zapatilla-nike-0');
    expect(command.items[0].raw).toEqual({ title: 'Zapatilla Nike', price: '29.99' });
    expect(command.fieldMappings).toEqual([
      { canonicalField: 'title', selector: '.t', type: 'text' },
      { canonicalField: 'price', selector: '.p', type: 'text' },
    ]);
  });

  it('parses price from canonicalField=precio with string value "29.99"', async () => {
    await useCase.execute({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'precio', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'X', precio: '29.99' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].price).toBe(29.99);
  });

  it('passes through numeric price values without coercion', async () => {
    await useCase.execute({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ price: 15 }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].price).toBe(15);
  });

  it('uses canonicalField=nombre as title fallback', async () => {
    await useCase.execute({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'nombre', selector: '.n', type: 'text' },
      ],
      products: [{ nombre: 'Camisa Roja' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].title).toBe('Camisa Roja');
  });

  it('auto-derives field mappings when none provided and warns once', async () => {
    await useCase.execute({
      domain: 'newstore.com',
      pageUrl: undefined,
      fieldMappings: undefined,
      products: [{ titulo: 'Producto Nuevo', precio: '9.99' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.fieldMappings).toHaveLength(2);
    expect(command.fieldMappings[0]).toEqual({
      canonicalField: 'titulo',
      selector: '',
      type: 'text',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('sent no fieldMappings'),
    );
  });

  it('warns when no canonical title mapping matches', async () => {
    await useCase.execute({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'precio', selector: '.p', type: 'text' },
      ],
      products: [{ precio: '5.00' }],
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no canonical title mapping'),
    );
    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].title).toBe('Raw product');
    expect(command.items[0].price).toBe(5.0);
  });

  it('falls back to "Raw product" + price=0 when no mappings at all (auto-derived)', async () => {
    await useCase.execute({
      domain: 'empty.com',
      pageUrl: undefined,
      fieldMappings: [],
      products: [{ foo: 'bar' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].title).toBe('Raw product');
    expect(command.items[0].price).toBe(0);
  });

  it('disambiguates two items with the same title via batch index', async () => {
    await useCase.execute({
      domain: 'shop.com',
      pageUrl: 'https://shop.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [
        { title: 'Same', price: '10' },
        { title: 'Same', price: '20' },
      ],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].url).toBe('https://shop.com/list#same-0');
    expect(command.items[1].url).toBe('https://shop.com/list#same-1');
    expect(command.items[0].url).not.toBe(command.items[1].url);
  });

  it('maps image / sku / description when their canonical mappings exist', async () => {
    await useCase.execute({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
        {
          canonicalField: 'image',
          selector: 'img',
          type: 'attribute',
          attribute: 'src',
        },
        { canonicalField: 'sku', selector: '.sku', type: 'text' },
        { canonicalField: 'descripcion', selector: '.desc', type: 'text' },
      ],
      products: [
        {
          title: 'Camisa',
          price: '12.50',
          image: 'https://shop.com/img.jpg',
          sku: 'SKU-1',
          descripcion: 'Camisa de algodón',
        },
      ],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].title).toBe('Camisa');
    expect(command.items[0].price).toBe(12.5);
    expect(command.items[0].imageUrl).toBe('https://shop.com/img.jpg');
    expect(command.items[0].sku).toBe('SKU-1');
    expect(command.items[0].description).toBe('Camisa de algodón');
  });

  it('falls back to domain as url prefix when pageUrl is undefined', async () => {
    await useCase.execute({
      domain: 'temu.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'X', price: '5' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.items[0].url).toBe('temu.com#x-0');
  });

  it('truncates long title slugs to 80 characters', async () => {
    const longTitle = 'A'.repeat(120);
    await useCase.execute({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: longTitle, price: '1' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    // The slug is the `-` replaced version, then truncated to 80 chars.
    const slugPart = command.items[0].url.split('#')[1].split('-').slice(0, -1).join('-');
    expect(slugPart.length).toBeLessThanOrEqual(80);
  });

  it('forwards categoryId through the ingest command', async () => {
    await useCase.execute({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      categoryId: 'cat_1',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'X', price: '5' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.categoryId).toBe('cat_1');
  });

  it('null-out categoryId when not provided', async () => {
    await useCase.execute({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'X' }],
    });

    const command = repository.ingest.mock.calls[0][0] as IngestCommand;
    expect(command.categoryId).toBeNull();
  });

  it('returns the ingest result forwarded from the repository', async () => {
    repository.ingest.mockResolvedValue({
      ingested: 3,
      domainRuleId: 'rule_1',
    });

    const result = await useCase.execute({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
    });

    expect(result).toEqual({ ingested: 3, domainRuleId: 'rule_1' });
  });
});
