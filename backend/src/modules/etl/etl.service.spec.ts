/**
 * Tests for EtlService (REQ-ETL-005).
 *
 * Asserts the Prisma query shape so any drift in the findLatest contract
 * (e.g. dropping the `where.status: SUCCESS` filter, or losing the include)
 * is caught by the test instead of by a silent 200-with-FAILED-run response.
 *
 * In-memory prisma stub — same pattern as `products.service.spec.ts`.
 */
import { EtlService } from './etl.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

type EtlRunRow = {
  id: string;
  source: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: Date;
  finishedAt: Date | null;
  rowsScraped: number;
  rowsPersisted: number;
  errorSummary: string | null;
  etlProducts: unknown[];
  qualityMetric: unknown | null;
};

function buildPrismaStub(seedRuns: EtlRunRow[] = []) {
  const runs: EtlRunRow[] = [...seedRuns];
  const findFirst = jest.fn(
    (args: {
      where: { status?: string };
      orderBy: { startedAt: 'asc' | 'desc' };
      include: unknown;
    }) => {
      // Mirror the service's filter: status === 'SUCCESS' (when set), orderBy desc.
      const filtered = args.where.status
        ? runs.filter((r) => r.status === args.where.status)
        : runs;
      const sorted = [...filtered].sort((a, b) => {
        const dir = args.orderBy.startedAt === 'desc' ? -1 : 1;
        return (a.startedAt.getTime() - b.startedAt.getTime()) * dir;
      });
      return sorted[0] ?? null;
    },
  );
  return { etlRun: { findFirst } } as unknown as PrismaService;
}

describe('EtlService.findLatest (REQ-ETL-005)', () => {
  it('queries for the latest SUCCESS run, ordered by startedAt desc, with products + qualityMetric inlined', async () => {
    const prisma = buildPrismaStub();
    const service = new EtlService(prisma);

    await service.findLatest();

    const args = (prisma.etlRun as unknown as { findFirst: jest.Mock }).findFirst.mock
      .calls[0][0];
    expect(args).toEqual(
      expect.objectContaining({
        where: { status: 'SUCCESS' },
        orderBy: { startedAt: 'desc' },
        include: expect.objectContaining({
          etlProducts: true,
          qualityMetric: true,
        }),
      }),
    );
  });

  it('returns the most recent SUCCESS run when several exist', async () => {
    const prisma = buildPrismaStub([
      {
        id: 'old-success',
        source: 'aliexpress',
        status: 'SUCCESS',
        startedAt: new Date('2026-07-04T02:00:00Z'),
        finishedAt: new Date('2026-07-04T02:01:00Z'),
        rowsScraped: 1,
        rowsPersisted: 1,
        errorSummary: null,
        etlProducts: [],
        qualityMetric: null,
      },
      {
        id: 'latest-success',
        source: 'aliexpress',
        status: 'SUCCESS',
        startedAt: new Date('2026-07-06T02:00:00Z'),
        finishedAt: new Date('2026-07-06T02:01:30Z'),
        rowsScraped: 6,
        rowsPersisted: 6,
        errorSummary: null,
        etlProducts: [],
        qualityMetric: null,
      },
      {
        id: 'failed-run',
        source: 'aliexpress',
        status: 'FAILED',
        startedAt: new Date('2026-07-07T02:00:00Z'),
        finishedAt: new Date('2026-07-07T02:00:30Z'),
        rowsScraped: 0,
        rowsPersisted: 0,
        errorSummary: 'playwright launch failed',
        etlProducts: [],
        qualityMetric: null,
      },
    ]);
    const service = new EtlService(prisma);

    const result = await service.findLatest();

    // FAILED run has a LATER startedAt than either SUCCESS — must NOT be returned.
    expect(result).toBeDefined();
    expect(result!.id).toBe('latest-success');
  });

  it('returns null when no SUCCESS run exists', async () => {
    const prisma = buildPrismaStub([
      {
        id: 'failed-1',
        source: 'aliexpress',
        status: 'FAILED',
        startedAt: new Date('2026-07-06T02:00:00Z'),
        finishedAt: new Date('2026-07-06T02:00:30Z'),
        rowsScraped: 0,
        rowsPersisted: 0,
        errorSummary: 'boom',
        etlProducts: [],
        qualityMetric: null,
      },
    ]);
    const service = new EtlService(prisma);

    expect(await service.findLatest()).toBeNull();
  });
});
