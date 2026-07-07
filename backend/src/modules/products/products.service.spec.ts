import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * In-memory mock for the Prisma surface this service touches.
 *
 * We intentionally do NOT spin up a real DB — the goal is to verify the
 * mapping logic (fieldMappings → normalized Product) without coupling tests
 * to schema or migration state.
 */
type DomainRuleRow = {
  id: string;
  domain: string;
  name: string;
  fieldMappings: unknown;
  containerSelector: string | null;
  productLimit: number | null;
  sampleUrl: string | null;
};

type ProductRow = {
  id: string;
  domainRuleId: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
  sku: string | null;
  description: string | null;
  rawData: unknown;
  extractedAt: Date;
};

function buildPrismaStub() {
  const domainRules = new Map<string, DomainRuleRow>();
  const products = new Map<string, ProductRow>();
  const priceHistory: Array<{
    productId: string;
    price: number;
    currency: string;
  }> = [];

  let nextProductId = 0;
  const newProductId = () => `prod_${++nextProductId}`;

  return {
    domainRule: {
      findUnique: jest.fn(({ where }: { where: { domain: string } }) => {
        return domainRules.get(where.domain) ?? null;
      }),
      create: jest.fn(({ data }: { data: Partial<DomainRuleRow> }) => {
        const row: DomainRuleRow = {
          id: `rule_${domainRules.size + 1}`,
          domain: data.domain!,
          name: data.name!,
          fieldMappings: data.fieldMappings ?? [],
          containerSelector: data.containerSelector ?? null,
          productLimit: data.productLimit ?? null,
          sampleUrl: data.sampleUrl ?? null,
        };
        domainRules.set(row.domain, row);
        return row;
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<DomainRuleRow>;
        }) => {
          const existing = Array.from(domainRules.values()).find(
            (r) => r.id === where.id,
          );
          if (!existing) throw new Error('not found');
          Object.assign(existing, data);
          return existing;
        },
      ),
    },
    product: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { productUrl: string; domainRuleId: string };
        }) => {
          return (
            Array.from(products.values()).find(
              (p) =>
                p.productUrl === where.productUrl &&
                p.domainRuleId === where.domainRuleId,
            ) ?? null
          );
        },
      ),
      create: jest.fn(({ data }: { data: Partial<ProductRow> }) => {
        const row: ProductRow = {
          id: newProductId(),
          domainRuleId: data.domainRuleId!,
          title: data.title ?? 'Unknown',
          price:
            typeof data.price === 'number'
              ? data.price
              : Number(data.price ?? 0),
          currency: data.currency ?? 'USD',
          imageUrl: data.imageUrl ?? null,
          productUrl: data.productUrl!,
          sku: data.sku ?? null,
          description: data.description ?? null,
          rawData: data.rawData ?? null,
          extractedAt: data.extractedAt ?? new Date(),
        };
        products.set(row.id, row);
        return row;
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<ProductRow>;
        }) => {
          const existing = products.get(where.id);
          if (!existing) throw new Error('not found');
          Object.assign(existing, data, {
            extractedAt: data.extractedAt ?? new Date(),
          });
          return existing;
        },
      ),
    },
    priceHistory: {
      create: jest.fn(
        ({
          data,
        }: {
          data: { productId: string; price: number; currency: string };
        }) => {
          priceHistory.push(data);
          return {
            id: `ph_${priceHistory.length}`,
            capturedAt: new Date(),
            ...data,
          };
        },
      ),
    },
    __state: { domainRules, products, priceHistory },
  };
}

describe('ProductsService.ingestFromExtension', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof buildPrismaStub>;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    prisma = buildPrismaStub();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('maps an inbound product to a normalized Product using fieldMappings', async () => {
    // Seed a rule that already exists for this domain
    prisma.__state.domainRules.set('temu.com', {
      id: 'rule_1',
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      containerSelector: '.card',
      productLimit: null,
      sampleUrl: null,
    });

    const result = await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    expect(result.ingested).toBe(1);
    const created = prisma.__state.products.get('prod_1');
    expect(created).toBeDefined();
    expect(created!.title).toBe('Zapatilla Nike');
  });

  it('auto-creates a DomainRule when domain is not in DB, deriving fieldMappings from inbound payload', async () => {
    const result = await service.ingestFromExtension({
      domain: 'newstore.com',
      pageUrl: undefined,
      fieldMappings: undefined,
      products: [{ titulo: 'Producto Nuevo', precio: '9.99' }],
    });

    expect(result.ingested).toBe(1);
    const rule = prisma.__state.domainRules.get('newstore.com');
    expect(rule).toBeDefined();
    expect(Array.isArray(rule!.fieldMappings)).toBe(true);
    expect((rule!.fieldMappings as unknown[]).length).toBe(2);
  });

  it('parses price from canonicalField=precio with string value "29.99" → 29.99', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_2',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'precio', selector: '.p', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'precio', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'X', precio: '29.99' }],
    });

    const created = prisma.__state.products.get('prod_1');
    expect(created!.price).toBe(29.99);
  });

  it('passes through numeric price values without coercion', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_3',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ price: 15 }],
    });

    const created = prisma.__state.products.get('prod_1');
    expect(created!.price).toBe(15);
  });

  it('uses canonicalField=nombre as title fallback', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_4',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'nombre', selector: '.n', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'nombre', selector: '.n', type: 'text' },
      ],
      products: [{ nombre: 'Camisa Roja' }],
    });

    const created = prisma.__state.products.get('prod_1');
    expect(created!.title).toBe('Camisa Roja');
  });

  it('updates an existing product instead of duplicating when productUrl collides', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_5',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    // First ingest
    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: 'https://shop.com/x',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'Same', price: '10' }],
    });

    expect(prisma.__state.products.size).toBe(1);
    expect(prisma.__state.priceHistory.length).toBe(1);

    // Second ingest — same domain + same title → same productUrl
    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: 'https://shop.com/x',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'Same', price: '12' }],
    });

    expect(prisma.__state.products.size).toBe(1);
    expect(prisma.__state.priceHistory.length).toBe(2);
    const updated = prisma.__state.products.get('prod_1');
    expect(updated!.price).toBe(12);
  });

  it('does NOT use the heuristic "first non-URL string under 200 chars" — title comes from fieldMappings', async () => {
    // If the heuristic were active, 'http://example.com/img.jpg' would NOT
    // be picked as title (good), but a numeric-looking field would. We assert
    // the title comes from the canonical 'title' mapping, not from scanning.
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_6',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    // Note: the FIRST key in the object is 'price' with a number-looking string.
    // Old heuristic would have grabbed "29.99" as title. New logic must grab
    // the canonical 'title' mapping instead.
    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ price: '29.99', title: 'Zapatilla Real' }],
    });

    const created = prisma.__state.products.get('prod_1');
    expect(created!.title).toBe('Zapatilla Real');
    expect(created!.price).toBe(29.99);
  });

  it('logs a warning when no canonical title mapping matches', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_7',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'precio', selector: '.p', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'precio', selector: '.p', type: 'text' },
      ],
      products: [{ precio: '5.00' }],
    });

    expect(warnSpy).toHaveBeenCalled();
    const created = prisma.__state.products.get('prod_1');
    // No title mapping → fallback constant. No heuristic scanning.
    expect(created!.title).toBe('Raw product');
    expect(created!.price).toBe(5.0);
  });

  it('maps image / sku / description when their canonical mappings exist', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_8',
      domain: 'shop.com',
      name: 'Shop',
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
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
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

    const created = prisma.__state.products.get('prod_1');
    expect(created!.title).toBe('Camisa');
    expect(created!.price).toBe(12.5);
    expect(created!.imageUrl).toBe('https://shop.com/img.jpg');
    expect(created!.sku).toBe('SKU-1');
    expect(created!.description).toBe('Camisa de algodón');
  });

  it('keeps UI-edited fieldMappings: ingest does NOT overwrite when rule already has mappings', async () => {
    // User has customized the rule via PATCH /domains/:id. Now they hit
    // "Extract" in the popup. The ingest should NOT clobber their edits.
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_9',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        {
          canonicalField: 'title',
          selector: '.user-custom-selector',
          type: 'text',
        },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        {
          canonicalField: 'title',
          selector: '.different-selector',
          type: 'text',
        },
      ],
      products: [{ title: 'Item', price: '5' }],
    });

    const ruleAfter = prisma.__state.domainRules.get('shop.com');
    expect(ruleAfter!.fieldMappings).toEqual([
      {
        canonicalField: 'title',
        selector: '.user-custom-selector',
        type: 'text',
      },
    ]);
  });

  it('populates an existing rule with empty fieldMappings when ingest provides one (legacy install recovery)', async () => {
    // Existing rule from before batch 1 has empty/null mappings. The
    // extension is now sending one. The ingest should fill it in once.
    prisma.__state.domainRules.set('legacy.com', {
      id: 'rule_10',
      domain: 'legacy.com',
      name: 'Legacy',
      fieldMappings: [],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'legacy.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Recovered' }],
    });

    const ruleAfter = prisma.__state.domainRules.get('legacy.com');
    expect((ruleAfter!.fieldMappings as unknown[]).length).toBe(1);
  });

  it('produces the legacy "Raw product" placeholder for existing installs without mappings (does not silently invent)', async () => {
    // Legacy rule with no mappings, ingest also has no mappings. The
    // service must NOT make up a title — it should emit the placeholder
    // and log a warning.
    prisma.__state.domainRules.set('legacy.com', {
      id: 'rule_11',
      domain: 'legacy.com',
      name: 'Legacy',
      fieldMappings: [],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
      domain: 'legacy.com',
      pageUrl: undefined,
      fieldMappings: undefined,
      products: [{ anything: 'data', more: 'stuff' }],
    });

    const created = prisma.__state.products.get('prod_1');
    expect(created!.title).toBe('Raw product');
    expect(created!.price).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('creates two distinct products when two items share the same title (productUrl must disambiguate)', async () => {
    prisma.__state.domainRules.set('shop.com', {
      id: 'rule_12',
      domain: 'shop.com',
      name: 'Shop',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
    });

    await service.ingestFromExtension({
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

    expect(prisma.__state.products.size).toBe(2);
    const urls = Array.from(prisma.__state.products.values()).map(
      (p) => p.productUrl,
    );
    expect(new Set(urls).size).toBe(2);
  });
});
