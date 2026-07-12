import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ProductsService } from './products.service';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';

/**
 * In-memory mock for the Prisma surface `ingestFromExtension` touches.
 *
 * `product-offer-split` rewrites the transaction to:
 *   Source upsert (code=domain) → DomainRule.sourceId backfill →
 *   Product upsert → Offer create/upsert → PriceObservation create →
 *   tx.rawCapture.upsert, all inside one `$transaction`.
 *
 * We intentionally do NOT spin up a real DB — the goal is to verify the
 * mapping + transaction-shape logic without coupling tests to schema or
 * migration state. `$transaction` here mirrors the pattern already used in
 * `categories.service.spec.ts`: the callback receives the SAME stub object
 * (no real isolation), which is enough to assert call order/shape.
 */
type DomainRuleRow = {
  id: string;
  domain: string;
  name: string;
  fieldMappings: unknown;
  containerSelector: string | null;
  productLimit: number | null;
  sampleUrl: string | null;
  sourceId: string | null;
};

type SourceRow = {
  id: string;
  code: string;
  name: string;
  baseUrl: string;
};

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
};

type OfferRow = {
  id: string;
  productId: string;
  sourceId: string;
  domainRuleId: string | null;
  url: string;
  sku: string | null;
  currency: string;
  price: number;
  rawData: unknown;
  extractedAt: Date;
};

function buildPrismaStub() {
  const domainRules = new Map<string, DomainRuleRow>();
  const sources = new Map<string, SourceRow>();
  const products = new Map<string, ProductRow>();
  const offers = new Map<string, OfferRow>();
  const priceObservations: Array<{
    offerId: string;
    price: number;
    currency: string;
  }> = [];
  const rawCaptures = new Map<
    string,
    { offerId: string; sourceId: string; payload: unknown; status?: string; attempts?: number }
  >();

  let nextProductId = 0;
  let nextOfferId = 0;
  let nextSourceId = 0;
  const newProductId = () => `prod_${++nextProductId}`;
  const newOfferId = () => `offer_${++nextOfferId}`;
  const newSourceId = () => `src_${++nextSourceId}`;
  const offerKey = (sourceId: string, url: string) => `${sourceId}::${url}`;
  const rawCaptureKey = (offerId: string, sourceId: string) =>
    `${offerId}::${sourceId}`;

  const stub = {
    source: {
      findUnique: jest.fn(({ where }: { where: { code: string } }) => {
        return sources.get(where.code) ?? null;
      }),
      create: jest.fn(({ data }: { data: Partial<SourceRow> }) => {
        const row: SourceRow = {
          id: newSourceId(),
          code: data.code!,
          name: data.name!,
          baseUrl: data.baseUrl!,
        };
        sources.set(row.code, row);
        return row;
      }),
    },
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
          sourceId: data.sourceId ?? null,
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
      create: jest.fn(({ data }: { data: Partial<ProductRow> }) => {
        const row: ProductRow = {
          id: newProductId(),
          title: data.title ?? 'Unknown',
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
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
          Object.assign(existing, data);
          return existing;
        },
      ),
    },
    offer: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { sourceId_url: { sourceId: string; url: string } };
        }) => {
          const k = offerKey(
            where.sourceId_url.sourceId,
            where.sourceId_url.url,
          );
          return (
            Array.from(offers.values()).find(
              (o) => offerKey(o.sourceId, o.url) === k,
            ) ?? null
          );
        },
      ),
      create: jest.fn(({ data }: { data: Partial<OfferRow> }) => {
        const row: OfferRow = {
          id: newOfferId(),
          productId: data.productId!,
          sourceId: data.sourceId!,
          domainRuleId: data.domainRuleId ?? null,
          url: data.url!,
          sku: data.sku ?? null,
          currency: data.currency ?? 'USD',
          price:
            typeof data.price === 'number'
              ? data.price
              : Number(data.price ?? 0),
          rawData: data.rawData ?? null,
          extractedAt: data.extractedAt ?? new Date(),
        };
        offers.set(row.id, row);
        return row;
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<OfferRow>;
        }) => {
          const existing = offers.get(where.id);
          if (!existing) throw new Error('not found');
          Object.assign(existing, data, {
            extractedAt: data.extractedAt ?? new Date(),
          });
          return existing;
        },
      ),
    },
    priceObservation: {
      create: jest.fn(
        ({
          data,
        }: {
          data: { offerId: string; price: number; currency: string };
        }) => {
          priceObservations.push(data);
          return {
            id: `po_${priceObservations.length}`,
            observedAt: new Date(),
            ...data,
          };
        },
      ),
    },
    rawCapture: {
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { offerId_sourceId: { offerId: string; sourceId: string } };
          create: { offerId: string; sourceId: string; payload: unknown; status?: string; attempts?: number };
          update: { payload: unknown; status?: string; attempts?: number };
        }) => {
          const k = rawCaptureKey(
            where.offerId_sourceId.offerId,
            where.offerId_sourceId.sourceId,
          );
          const existing = rawCaptures.get(k);
          if (existing) {
            existing.payload = update.payload;
            existing.status = update.status;
            existing.attempts = update.attempts;
            return existing;
          }
          const row = { ...create };
          rawCaptures.set(k, row);
          return row;
        },
      ),
    },
    $transaction: jest.fn(async <T>(fn: (tx: typeof stub) => Promise<T>) => {
      return fn(stub);
    }),
    __state: {
      domainRules,
      sources,
      products,
      offers,
      priceObservations,
      rawCaptures,
    },
  };

  return stub;
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
        { provide: OperationalPrismaService, useValue: prisma },
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

  it('runs the whole ingest inside one $transaction', async () => {
    await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('upserts a Source keyed by domain (code=domain, baseUrl=https://{domain})', async () => {
    await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    const source = prisma.__state.sources.get('temu.com');
    expect(source).toBeDefined();
    expect(source!.baseUrl).toBe('https://temu.com');
  });

  it('reuses an existing Source on a second ingest for the same domain (no duplicate Source rows)', async () => {
    await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Item A', price: '10' }],
    });
    await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Item B', price: '20' }],
    });

    expect(prisma.__state.sources.size).toBe(1);
  });

  it('backfills DomainRule.sourceId when an existing rule has none yet', async () => {
    prisma.__state.domainRules.set('legacy.com', {
      id: 'rule_legacy',
      domain: 'legacy.com',
      name: 'Legacy',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      containerSelector: null,
      productLimit: null,
      sampleUrl: null,
      sourceId: null,
    });

    await service.ingestFromExtension({
      domain: 'legacy.com',
      pageUrl: undefined,
      fieldMappings: undefined,
      products: [{ title: 'X' }],
    });

    const rule = prisma.__state.domainRules.get('legacy.com');
    expect(rule!.sourceId).toBeDefined();
    expect(rule!.sourceId).toBe(prisma.__state.sources.get('legacy.com')!.id);
  });

  it('maps an inbound product to a canonical Product + Offer using fieldMappings', async () => {
    const result = await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    expect(result.ingested).toBe(1);
    const offer = prisma.__state.offers.get('offer_1');
    expect(offer).toBeDefined();
    const product = prisma.__state.products.get(offer!.productId);
    expect(product!.title).toBe('Zapatilla Nike');
    expect(offer!.price).toBe(29.99);
  });

  it('creates exactly one PriceObservation per ingested item', async () => {
    await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    expect(prisma.__state.priceObservations).toHaveLength(1);
    expect(prisma.__state.priceObservations[0].price).toBe(29.99);
  });

  it('writes a RawCapture keyed by (offerId, sourceId) via tx.rawCapture.upsert', async () => {
    await service.ingestFromExtension({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'Zapatilla Nike', price: '29.99' }],
    });

    const offer = prisma.__state.offers.get('offer_1')!;
    const source = prisma.__state.sources.get('temu.com')!;
    const capture = prisma.__state.rawCaptures.get(
      `${offer.id}::${source.id}`,
    );
    expect(capture).toBeDefined();
    expect(capture!.payload).toEqual({ title: 'Zapatilla Nike', price: '29.99' });
    expect(capture!.status).toBe('UNPROCESSED');
    expect(capture!.attempts).toBe(0);
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
    expect(rule!.sourceId).toBeDefined();
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
      sourceId: null,
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

    const offer = prisma.__state.offers.get('offer_1');
    expect(offer!.price).toBe(29.99);
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
      sourceId: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
      ],
      products: [{ price: 15 }],
    });

    const offer = prisma.__state.offers.get('offer_1');
    expect(offer!.price).toBe(15);
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
      sourceId: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'nombre', selector: '.n', type: 'text' },
      ],
      products: [{ nombre: 'Camisa Roja' }],
    });

    const offer = prisma.__state.offers.get('offer_1')!;
    const product = prisma.__state.products.get(offer.productId)!;
    expect(product.title).toBe('Camisa Roja');
  });

  it('updates the existing Offer + Product instead of duplicating when the (source,url) pair collides', async () => {
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
      sourceId: null,
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
    expect(prisma.__state.offers.size).toBe(1);
    expect(prisma.__state.priceObservations).toHaveLength(1);

    // Second ingest — same domain + same title → same (sourceId, url)
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
    expect(prisma.__state.offers.size).toBe(1);
    expect(prisma.__state.priceObservations).toHaveLength(2);
    const offer = prisma.__state.offers.get('offer_1');
    expect(offer!.price).toBe(12);
  });

  it('does NOT use the heuristic "first non-URL string under 200 chars" — title comes from fieldMappings', async () => {
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
      sourceId: null,
    });

    await service.ingestFromExtension({
      domain: 'shop.com',
      pageUrl: undefined,
      fieldMappings: [
        { canonicalField: 'price', selector: '.p', type: 'text' },
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ price: '29.99', title: 'Zapatilla Real' }],
    });

    const offer = prisma.__state.offers.get('offer_1')!;
    const product = prisma.__state.products.get(offer.productId)!;
    expect(product.title).toBe('Zapatilla Real');
    expect(offer.price).toBe(29.99);
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
      sourceId: null,
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
    const offer = prisma.__state.offers.get('offer_1')!;
    const product = prisma.__state.products.get(offer.productId)!;
    expect(product.title).toBe('Raw product');
    expect(offer.price).toBe(5.0);
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
      sourceId: null,
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

    const offer = prisma.__state.offers.get('offer_1')!;
    const product = prisma.__state.products.get(offer.productId)!;
    expect(product.title).toBe('Camisa');
    expect(offer.price).toBe(12.5);
    expect(product.imageUrl).toBe('https://shop.com/img.jpg');
    expect(offer.sku).toBe('SKU-1');
    expect(product.description).toBe('Camisa de algodón');
  });

  it('keeps UI-edited fieldMappings: ingest does NOT overwrite when rule already has mappings', async () => {
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
      sourceId: 'src_preexisting',
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

  it('creates two distinct Products+Offers when two items share the same title (url must disambiguate, no dedup)', async () => {
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
      sourceId: null,
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
    expect(prisma.__state.offers.size).toBe(2);
    const urls = Array.from(prisma.__state.offers.values()).map((o) => o.url);
    expect(new Set(urls).size).toBe(2);
  });
});
