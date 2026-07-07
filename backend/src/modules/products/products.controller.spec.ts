import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Verifies that the products controller exposes the right routes after
 * Batch 2's C1 fix (rename `domain/:id` → `by-domain/:id` to avoid the
 * collision with `:id`).
 *
 * We assert at three levels:
 *   1. The decorator metadata on the controller class lists both routes.
 *   2. The old `domain/:id` route handler is no longer present.
 *   3. The new `by-domain/:id` handler delegates to the service.
 *
 * Decorator-based route assertion catches the regression even without
 * spinning up the full Nest HTTP pipeline.
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

describe('ProductsController routes (Batch 2 / C1)', () => {
  let controllerInstance: ProductsController;
  let serviceMock: { findAllByDomain: jest.Mock };

  beforeEach(async () => {
    serviceMock = { findAllByDomain: jest.fn().mockResolvedValue([]) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            findAllByDomain: serviceMock.findAllByDomain,
            findAll: jest.fn(),
            findOne: jest.fn(),
            getPriceHistory: jest.fn(),
            ingestFromExtension: jest.fn(),
            upsert: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerInstance = moduleRef.get(ProductsController);
  });

  it('exposes the new by-domain route (renamed from domain/:id)', () => {
    const routes = getControllerRoutes(controllerInstance);
    const byDomain = routes.find((r) => r.path.startsWith('by-domain/'));
    expect(byDomain).toBeDefined();
    expect(byDomain!.method).toBe('GET');
    expect(byDomain!.handlerName).toBe('findByDomain');
  });

  it('does NOT expose the unreachable /products/domain/:id route', () => {
    const routes = getControllerRoutes(controllerInstance);
    const stale = routes.find((r) => r.path.startsWith('domain/'));
    expect(stale).toBeUndefined();
  });

  it('still exposes /products/:id (the canonical product-by-id lookup)', () => {
    const routes = getControllerRoutes(controllerInstance);
    const byId = routes.find((r) => r.path === ':id');
    expect(byId).toBeDefined();
    expect(byId!.method).toBe('GET');
  });

  it('findByDomain delegates to service.findAllByDomain', async () => {
    const fakeId = 'rule-uuid-123';
    await controllerInstance.findByDomain(fakeId);
    expect(serviceMock.findAllByDomain).toHaveBeenCalledWith(fakeId);
  });
});

/**
 * 4R HIGH #2: integration tests for the controller's response shaping.
 *
 * The route-level spec above mocks `findAllByDomain: jest.fn()` and
 * never exercises the actual `plainToInstance(...)` call. These tests
 * stub `findOne` to return a Prisma-shaped row with a LIVE
 * `Prisma.Decimal` (the in-process shape, not the JSON-stringified
 * shape), then call the controller method directly and assert:
 *   1. The call does not throw (BLOCKER regression guard).
 *   2. The response shape matches `ProductResponseDto` (price is a
 *      number, leak surfaces stripped).
 *
 * If anyone removes `{ excludeExtraneousValues: true }` from
 * `plainToInstance(...)` in `products.controller.ts`, these tests go
 * RED on the very first `await controllerInstance.findOne(...)`.
 */
describe('ProductsController response shaping (4R HIGH #2)', () => {
  let controllerInstance: ProductsController;
  let productsServiceMock: {
    findAllByDomain: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    getPriceHistory: jest.Mock;
    ingestFromExtension: jest.Mock;
    upsert: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  const { Decimal } = Prisma;

  beforeEach(async () => {
    productsServiceMock = {
      findAllByDomain: jest.fn().mockResolvedValue([]),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getPriceHistory: jest.fn(),
      ingestFromExtension: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsServiceMock }],
    }).compile();

    controllerInstance = moduleRef.get(ProductsController);
  });

  it('findOne shapes a Prisma row with live Decimal + nested relations into a ProductResponseDto (no throw, no leak)', async () => {
    // Stub findOne to return a row shaped exactly like a real Prisma
    // response: live Decimal price + populated priceHistory[] + a
    // joined domainRule relation. This is the BLOCKER scenario.
    productsServiceMock.findOne.mockResolvedValue({
      id: 'p-int-1',
      domainRuleId: 'r-1',
      title: 'Integration',
      price: new Decimal('19.99'),
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      priceHistory: [
        {
          id: 'h-1',
          productId: 'p-int-1',
          price: new Decimal('29.50'),
          currency: 'USD',
          capturedAt: new Date('2026-01-02T00:00:00.000Z'),
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      domainRule: {
        id: 'r-1',
        domain: 'temu.com',
        name: 'Temu',
      },
    });

    // Must not throw — that was the production 500 BLOCKER.
    const dto = await controllerInstance.findOne('p-int-1');

    // Price must be a number (Spec 2 REQ-DT-1 contract).
    expect(typeof dto.price).toBe('number');
    expect(dto.price).toBe(19.99);

    // Whitelist must have stripped nested relations (4R CRITICAL #1).
    expect(
      (dto as unknown as Record<string, unknown>).priceHistory,
    ).toBeUndefined();
    expect(
      (dto as unknown as Record<string, unknown>).domainRule,
    ).toBeUndefined();

    // Whitelisted identity fields survived.
    expect(dto.id).toBe('p-int-1');
    expect(dto.title).toBe('Integration');
    expect(dto.currency).toBe('USD');
    expect(dto.productUrl).toBe('https://temu.com/x');
  });

  it('findAll maps every Prisma row through plainToInstance (list endpoint wrap)', async () => {
    productsServiceMock.findAll.mockResolvedValue([
      {
        id: 'p-list-1',
        domainRuleId: 'r-1',
        title: 'List item 1',
        price: new Decimal('9.99'),
        currency: 'USD',
        productUrl: 'https://temu.com/a',
        extractedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        priceHistory: [],
      },
      {
        id: 'p-list-2',
        domainRuleId: 'r-1',
        title: 'List item 2',
        price: new Decimal('14.50'),
        currency: 'USD',
        productUrl: 'https://temu.com/b',
        extractedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        priceHistory: [],
      },
    ]);

    const dtos = await controllerInstance.findAll({});

    expect(dtos).toHaveLength(2);
    expect(typeof dtos[0].price).toBe('number');
    expect(dtos[0].price).toBe(9.99);
    expect(typeof dtos[1].price).toBe('number');
    expect(dtos[1].price).toBe(14.5);
  });

  it('getPriceHistory maps every entry through plainToInstance (4R CRITICAL #3)', async () => {
    productsServiceMock.findOne.mockResolvedValue({
      id: 'p-hist-int-1',
      domainRuleId: 'r-1',
      title: 'With history',
      price: new Decimal('19.99'),
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    productsServiceMock.getPriceHistory.mockResolvedValue([
      {
        id: 'h-int-1',
        productId: 'p-hist-int-1',
        price: new Decimal('29.50'),
        currency: 'USD',
        capturedAt: new Date('2026-01-02T00:00:00.000Z'),
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        // Leak surface — joined `product` relation. Must be stripped.
        product: {
          id: 'p-hist-int-1',
          title: 'Should not leak',
        },
      },
    ]);

    const history = await controllerInstance.getPriceHistory('p-hist-int-1');

    expect(history).toHaveLength(1);
    expect(typeof history[0].price).toBe('number');
    expect(history[0].price).toBe(29.5);
    expect(
      (history[0] as unknown as Record<string, unknown>).product,
    ).toBeUndefined();
    expect(history[0].productId).toBe('p-hist-int-1');
  });
});
