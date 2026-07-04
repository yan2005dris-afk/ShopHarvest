import { Test, TestingModule } from '@nestjs/testing';
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
