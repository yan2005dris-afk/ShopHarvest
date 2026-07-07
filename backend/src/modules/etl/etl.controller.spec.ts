/**
 * Tests for EtlController (REQ-ETL-005, T-ETL-005).
 *
 * Asserts:
 *   1. Route is `GET /api/etl/runs/latest` (decorator metadata).
 *   2. Route is NOT marked @Public() → global JwtAuthGuard applies (401 case).
 *   3. Controller delegates to EtlService.findLatest().
 *   4. When the service returns a run, the controller returns it (200 case).
 *   5. When the service returns null, the controller throws NotFoundException (404 case).
 *
 * Follows the same decorator-metadata pattern as
 * `backend/src/modules/products/products.controller.spec.ts` — no supertest
 * boot, no real DB, no real JWT. The 401 path is proven by absence of
 * @Public() metadata, which is what the global JwtAuthGuard honors.
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { EtlController } from './etl.controller';
import { EtlService } from './etl.service';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';

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
  const prototype = Object.getPrototypeOf(controller) as Record<string, unknown>;
  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (n) => n !== 'constructor' && typeof prototype[n] === 'function',
  );
  return methodNames.flatMap((name) => {
    const handler = prototype[name] as object;
    const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
    const methodNum = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
    if (!path || methodNum === undefined) return [];
    return [{ method: METHOD_NAMES[methodNum] ?? String(methodNum), path, handlerName: name }];
  });
}

const sampleRun = {
  id: 'run-uuid-1',
  source: 'aliexpress',
  status: 'SUCCESS' as const,
  startedAt: new Date('2026-07-06T02:00:00Z'),
  finishedAt: new Date('2026-07-06T02:01:30Z'),
  rowsScraped: 6,
  rowsPersisted: 6,
  errorSummary: null,
  etlProducts: [
    {
      id: 'prod-1',
      etlRunId: 'run-uuid-1',
      source: 'aliexpress',
      sourceId: 'mystery:sharp-objects',
      title: 'Sharp Objects',
      price: 47.82,
      currency: 'GBP',
      availability: 'In stock',
      rawJson: { titulo: 'Sharp Objects' },
      scrapedAt: new Date('2026-07-06T02:00:30Z'),
    },
  ],
  qualityMetric: {
    id: 'qm-1',
    etlRunId: 'run-uuid-1',
    completenessPct: 100,
    duplicatesRemoved: 0,
    checks: { titlesNonEmpty: { passed: 6, failed: 0 } },
  },
};

describe('EtlController (REQ-ETL-005)', () => {
  let controller: EtlController;
  let findLatestMock: jest.Mock;

  beforeEach(async () => {
    findLatestMock = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EtlController],
      providers: [
        { provide: EtlService, useValue: { findLatest: findLatestMock } },
      ],
    }).compile();

    controller = moduleRef.get(EtlController);
  });

  it('exposes GET /api/etl/runs/latest', () => {
    const routes = getControllerRoutes(controller);
    const target = routes.find((r) => r.path === 'runs/latest');
    expect(target).toBeDefined();
    expect(target!.method).toBe('GET');
    expect(target!.handlerName).toBe('findLatest');
  });

  it('does NOT mark the route @Public() — global JwtAuthGuard applies (401 case)', () => {
    // The global guard is verified by the ABSENCE of IS_PUBLIC_KEY on the
    // handler. If a future refactor adds @Public(), the test fails.
    const routes = getControllerRoutes(controller);
    const target = routes.find((r) => r.path === 'runs/latest')!;
    const handler = (controller as unknown as Record<string, object>)[
      target.handlerName
    ];
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler);
    expect(isPublic).toBeUndefined();
  });

  it('returns the latest run when the service resolves one (200 case)', async () => {
    findLatestMock.mockResolvedValue(sampleRun);

    const result = await controller.findLatest();

    expect(result).toEqual(sampleRun);
    expect(findLatestMock).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when the service resolves null (404 case)', async () => {
    findLatestMock.mockResolvedValue(null);

    await expect(controller.findLatest()).rejects.toBeInstanceOf(NotFoundException);
    expect(findLatestMock).toHaveBeenCalledTimes(1);
  });
});
