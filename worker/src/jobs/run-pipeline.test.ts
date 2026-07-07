/**
 * Integration test for the ETL tick orchestration.
 *
 * Verifies the wiring that PR 1 stubbed out in `worker/src/main.ts:33-37`:
 *   - getInFlightRun: a previous RUNNING run → skip the new tick (idempotency)
 *   - happy path: createRun → scrape → persistProducts → createQualityMetric → completeRun
 *   - failure path: scrape throws → failRun with the error message in errorSummary
 *
 * The same `runEtlTick` function is the unit tested here AND consumed by the
 * cron callback in main.ts, so the test doubles as the cron-callback test
 * the orchestrator requires.
 *
 * RED phase: run-pipeline.ts does not exist yet.
 */
import { runEtlTick } from './run-pipeline';
import type { PrismaClient } from '@prisma/client';
import type { ScrapedProduct } from './aliexpress.job';

type EtlRunRow = {
  id: string;
  source: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: Date;
  finishedAt: Date | null;
  rowsScraped: number;
  rowsPersisted: number;
  errorSummary: string | null;
};

type EtlProductRow = {
  id: string;
  etlRunId: string;
  source: string;
  sourceId: string;
  title: string;
  price: number | null;
  currency: string;
  availability: string | null;
  rawJson: unknown;
  scrapedAt: Date;
};

type QualityMetricRow = {
  id: string;
  etlRunId: string;
  completenessPct: number;
  duplicatesRemoved: number;
  checks: unknown;
};

function buildPrismaStub() {
  const runs: EtlRunRow[] = [];
  const products: EtlProductRow[] = [];
  const metrics: QualityMetricRow[] = [];
  let nextRunId = 0;
  let nextProductId = 0;
  let nextMetricId = 0;

  // Build the model mocks FIRST so $transaction can reference them
  // (avoids `this`-binding pitfalls in arrow functions).
  const etlRun = {
    create: jest.fn(({ data }: { data: Partial<EtlRunRow> }) => {
      const row: EtlRunRow = {
        id: `run-${++nextRunId}`,
        source: data.source!,
        status: data.status!,
        startedAt: data.startedAt ?? new Date(),
        finishedAt: data.finishedAt ?? null,
        rowsScraped: data.rowsScraped ?? 0,
        rowsPersisted: data.rowsPersisted ?? 0,
        errorSummary: data.errorSummary ?? null,
      };
      runs.push(row);
      return row;
    }),
    update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<EtlRunRow> }) => {
      const run = runs.find((r) => r.id === where.id);
      if (!run) throw new Error(`EtlRun not found: ${where.id}`);
      Object.assign(run, data);
      return run;
    }),
    findFirst: jest.fn(({ where }: { where: { source: string; status: string } }) => {
      return (
        runs.find((r) => r.source === where.source && r.status === where.status) ?? null
      );
    }),
  };

  const etlProduct = {
    upsert: jest.fn(({ where, create, update }: {
      where: { source_sourceId: { source: string; sourceId: string } };
      create: Omit<EtlProductRow, 'id'>;
      update: Partial<EtlProductRow>;
    }) => {
      const existing = products.find(
        (p) =>
          p.source === where.source_sourceId.source &&
          p.sourceId === where.source_sourceId.sourceId,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row: EtlProductRow = {
        id: `prod-${++nextProductId}`,
        ...create,
      };
      products.push(row);
      return row;
    }),
  };

  const qualityMetric = {
    create: jest.fn(({ data }: { data: Omit<QualityMetricRow, 'id'> }) => {
      const row: QualityMetricRow = { id: `qm-${++nextMetricId}`, ...data };
      metrics.push(row);
      return row;
    }),
  };

  // Mirrors Prisma: $transaction(cb) → cb(tx) → result. Required because
  // EtlProductRepository.persistProducts wraps its upserts in a transaction.
  // The tx surfaces the SAME mocks (etlProduct/qualityMetric) so writes
  // accumulate into the same in-memory arrays.
  const $transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({ etlProduct, qualityMetric });
  });

  return {
    etlRun,
    etlProduct,
    qualityMetric,
    $transaction,
    __state: { runs, products, metrics },
  } as unknown as PrismaClient & {
    __state: { runs: EtlRunRow[]; products: EtlProductRow[]; metrics: QualityMetricRow[] };
  };
}

const noopLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('runEtlTick (cron callback wiring + REQ-ETL-002/003/004/007)', () => {
  beforeEach(() => {
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  it('skips the tick when a previous RUNNING run is still in-flight (idempotency)', async () => {
    const prisma = buildPrismaStub();
    // Seed an in-flight run.
    prisma.etlRun.create({
      data: { source: 'aliexpress', status: 'RUNNING', startedAt: new Date() },
    });
    const scrape = jest.fn();

    const result = await runEtlTick({
      prisma: prisma as never,
      source: 'aliexpress',
      scrape,
      logger: noopLogger as never,
    });

    expect(result.status).toBe('skipped');
    expect(scrape).not.toHaveBeenCalled();
    // The seeded in-flight run was the only one — no NEW run was created.
    expect(prisma.__state.runs).toHaveLength(1);
  });

  it('happy path: createRun → scrape → persistProducts → createQualityMetric → completeRun', async () => {
    const prisma = buildPrismaStub();
    // Note: shape must match EtlProductRepository.persistProducts expectations
    // (sourceId + title are required keys). titulo/precio/moneda would be
    // undefined → both products would collapse to the same (source, undefined)
    // upsert key.
    const fakeProducts: ScrapedProduct[] = [
      {
        sourceId: 'mystery:sharp-objects',
        title: 'Sharp Objects',
        price: 47.82,
        currency: 'GBP',
        availability: 'In stock',
        rawJson: { titulo: 'Sharp Objects' },
      },
      {
        sourceId: 'fiction:the-stand',
        title: 'The Stand',
        price: 36.2,
        currency: 'GBP',
        availability: 'In stock',
        rawJson: { titulo: 'The Stand' },
      },
    ];
    const scrape = jest.fn().mockResolvedValue(fakeProducts);

    const result = await runEtlTick({
      prisma: prisma as never,
      source: 'aliexpress',
      scrape,
      logger: noopLogger as never,
    });

    expect(result.status).toBe('completed');
    expect(result.runId).toBe('run-1');

    // One RUNNING run, then updated to SUCCESS.
    expect(prisma.__state.runs).toHaveLength(1);
    const run = prisma.__state.runs[0];
    expect(run.status).toBe('SUCCESS');
    expect(run.rowsScraped).toBe(2);
    expect(run.rowsPersisted).toBe(2);
    expect(run.finishedAt).toBeInstanceOf(Date);

    // Two products persisted, both with the source + etlRunId stamp.
    expect(prisma.__state.products).toHaveLength(2);
    for (const p of prisma.__state.products) {
      expect(p.source).toBe('aliexpress');
      expect(p.etlRunId).toBe('run-1');
    }

    // One quality metric, scoped to the run, completeness 100% (2/2).
    expect(prisma.__state.metrics).toHaveLength(1);
    expect(prisma.__state.metrics[0].etlRunId).toBe('run-1');
    expect(prisma.__state.metrics[0].completenessPct).toBe(100);
  });

  it('failure path: scrape throws → run marked FAILED with errorSummary, no products persisted', async () => {
    const prisma = buildPrismaStub();
    const scrape = jest.fn().mockRejectedValue(new Error('playwright launch failed'));

    const result = await runEtlTick({
      prisma: prisma as never,
      source: 'aliexpress',
      scrape,
      logger: noopLogger as never,
    });

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('playwright launch failed');

    const run = prisma.__state.runs[0];
    expect(run.status).toBe('FAILED');
    expect(run.errorSummary).toBe('playwright launch failed');
    expect(run.finishedAt).toBeInstanceOf(Date);
    expect(run.rowsScraped).toBe(0);
    expect(run.rowsPersisted).toBe(0);

    // Nothing else should have been written.
    expect(prisma.__state.products).toHaveLength(0);
    expect(prisma.__state.metrics).toHaveLength(0);
  });

  it('persists the same product twice with the same source/sourceId idempotently (REQ-ETL-003)', async () => {
    const prisma = buildPrismaStub();
    const products: ScrapedProduct[] = [
      { sourceId: 'fiction:book-a', title: 'Book A' },
    ];
    const scrape = jest.fn().mockResolvedValue(products);

    // Two consecutive ticks with identical input — second should upsert, not create.
    await runEtlTick({
      prisma: prisma as never,
      source: 'aliexpress',
      scrape,
      logger: noopLogger as never,
    });
    // First run is now SUCCESS, so the second tick is not skipped.
    await runEtlTick({
      prisma: prisma as never,
      source: 'aliexpress',
      scrape,
      logger: noopLogger as never,
    });

    expect(prisma.__state.runs).toHaveLength(2);
    expect(prisma.__state.products).toHaveLength(1); // NOT duplicated
  });
});
