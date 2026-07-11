import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/operational';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Verifies that the products controller exposes the right routes.
 *
 * `product-offer-split`:
 *   - `POST /products/upsert` (dead, zero callers) is removed.
 *   - `POST /products` (legacy admin `create`) is removed along with
 *     `ProductsService.create()`.
 *   - `/products/:id/history` now returns `PriceObservationResponseDto[]`
 *     sourced across the product's `Offer`(s).
 */
import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

interface RouteEntry {
  method: string;
  path: string;
  handlerName: string;
}

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

function getControllerRoutes(controller: object): RouteEntry[] {
  const prototype = Object.getPrototypeOf(controller) as Record<
    string,
    unknown
  >;
  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (n) => n !== 'constructor' && typeof prototype[n] === 'function',
  );

  return methodNames.flatMap((name) => {
    const handler = prototype[name] as object;
    const path = Reflect.getMetadata(PATH_METADATA, handler) as
      | string
      | undefined;
    const methodNum = Reflect.getMetadata(METHOD_METADATA, handler) as
      | number
      | undefined;
    if (!path || methodNum === undefined) return [];
    return [
      {
        method: METHOD_NAMES[methodNum] ?? String(methodNum),
        path,
        handlerName: name,
      },
    ];
  });
}

function buildServiceMock() {
  return {
    findAllByDomain: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    getPriceHistory: jest.fn(),
    ingestFromExtension: jest.fn(),
    remove: jest.fn(),
  };
}

describe('ProductsController routes', () => {
  let controllerInstance: ProductsController;
  let serviceMock: ReturnType<typeof buildServiceMock>;

  beforeEach(async () => {
    serviceMock = buildServiceMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: serviceMock }],
    }).compile();

    controllerInstance = moduleRef.get(ProductsController);
  });

  it('exposes the by-domain route', () => {
    const routes = getControllerRoutes(controllerInstance);
    const byDomain = routes.find((r) => r.path.startsWith('by-domain/'));
    expect(byDomain).toBeDefined();
    expect(byDomain!.method).toBe('GET');
    expect(byDomain!.handlerName).toBe('findByDomain');
  });

  it('still exposes /products/:id (the canonical product-by-id lookup)', () => {
    const routes = getControllerRoutes(controllerInstance);
    const byId = routes.find((r) => r.path === ':id');
    expect(byId).toBeDefined();
    expect(byId!.method).toBe('GET');
  });

  it('does NOT expose POST /products/upsert (dead endpoint, zero callers)', () => {
    const routes = getControllerRoutes(controllerInstance);
    const upsert = routes.find(
      (r) => r.path === 'upsert' && r.method === 'POST',
    );
    expect(upsert).toBeUndefined();
  });

  it('does NOT expose POST /products (legacy admin create removed with it)', () => {
    const routes = getControllerRoutes(controllerInstance);
    const create = routes.find((r) => r.path === '' && r.method === 'POST');
    expect(create).toBeUndefined();
  });

  it('findByDomain delegates to service.findAllByDomain', async () => {
    const fakeId = 'rule-uuid-123';
    await controllerInstance.findByDomain(fakeId);
    expect(serviceMock.findAllByDomain).toHaveBeenCalledWith(fakeId);
  });
});

/**
 * Integration-style tests for the controller's offer-level response
 * shaping. Stubs the service to return Prisma-shaped rows with a LIVE
 * `Prisma.Decimal` on nested `offers[]` (the in-process shape, not the
 * JSON-stringified shape), then calls the controller method directly.
 */
describe('ProductsController response shaping (offer-level, product-offer-split)', () => {
  let controllerInstance: ProductsController;
  let productsServiceMock: ReturnType<typeof buildServiceMock>;
  const { Decimal } = Prisma;

  beforeEach(async () => {
    productsServiceMock = buildServiceMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsServiceMock }],
    }).compile();

    controllerInstance = moduleRef.get(ProductsController);
  });

  it('findOne shapes a Prisma row with a live-Decimal offers[] into a ProductResponseDto (no throw, no leak)', async () => {
    productsServiceMock.findOne.mockResolvedValue({
      id: 'p-int-1',
      title: 'Integration',
      description: null,
      imageUrl: null,
      categoryId: null,
      brandId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      offers: [
        {
          id: 'o-1',
          productId: 'p-int-1',
          sourceId: 's-1',
          domainRuleId: 'r-1',
          url: 'https://temu.com/x',
          price: new Decimal('19.99'),
          currency: 'USD',
          extractedAt: new Date('2026-01-01T00:00:00.000Z'),
          // Leak surfaces that must be stripped by OfferResponseDto's whitelist:
          rawData: { some: 'blob' },
        },
      ],
    });

    // Must not throw — that was the original production 500 BLOCKER (now
    // guarded for the nested offers[] relation instead of priceHistory[]).
    const dto = await controllerInstance.findOne('p-int-1');

    expect(dto.id).toBe('p-int-1');
    expect(dto.title).toBe('Integration');
    expect(dto.offers).toHaveLength(1);
    expect(typeof dto.offers[0].price).toBe('number');
    expect(dto.offers[0].price).toBe(19.99);
    expect(dto.offers[0].url).toBe('https://temu.com/x');
    expect(
      (dto.offers[0] as unknown as Record<string, unknown>).rawData,
    ).toBeUndefined();
  });

  it('findAll maps every Prisma row through plainToInstance (list endpoint wrap)', async () => {
    productsServiceMock.findAll.mockResolvedValue([
      {
        id: 'p-list-1',
        title: 'List item 1',
        description: null,
        imageUrl: null,
        categoryId: null,
        brandId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        offers: [
          {
            id: 'o-list-1',
            productId: 'p-list-1',
            sourceId: 's-1',
            url: 'https://temu.com/a',
            price: new Decimal('9.99'),
            currency: 'USD',
            extractedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const dtos = await controllerInstance.findAll({});

    expect(dtos).toHaveLength(1);
    expect(dtos[0].offers).toHaveLength(1);
    expect(typeof dtos[0].offers[0].price).toBe('number');
    expect(dtos[0].offers[0].price).toBe(9.99);
  });

  it('getPriceHistory maps every PriceObservation entry through plainToInstance', async () => {
    productsServiceMock.findOne.mockResolvedValue({
      id: 'p-hist-int-1',
      title: 'With history',
      description: null,
      imageUrl: null,
      categoryId: null,
      brandId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      offers: [],
    });

    productsServiceMock.getPriceHistory.mockResolvedValue([
      {
        id: 'po-int-1',
        offerId: 'o-1',
        price: new Decimal('29.50'),
        currency: 'USD',
        observedAt: new Date('2026-01-02T00:00:00.000Z'),
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        // Leak surface — joined `offer` relation. Must be stripped.
        offer: { id: 'o-1', url: 'Should not leak' },
      },
    ]);

    const history = await controllerInstance.getPriceHistory('p-hist-int-1');

    expect(history).toHaveLength(1);
    expect(typeof history[0].price).toBe('number');
    expect(history[0].price).toBe(29.5);
    expect(
      (history[0] as unknown as Record<string, unknown>).offer,
    ).toBeUndefined();
    expect(history[0].offerId).toBe('o-1');
  });
});
