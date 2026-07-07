/**
 * ETL tick orchestration.
 *
 * Wires the cron callback (set up in `worker/src/main.ts`) to the persistence
 * layer from PR 1. The contract is:
 *
 *   1. If a RUNNING run already exists for this source, skip the tick and
 *      log it (REQ-ETL-002 idempotency).
 *   2. Otherwise, create a new RUNNING run.
 *   3. Call the scraper. On success: persist products + a quality metric
 *      and mark the run SUCCESS (REQ-ETL-003, REQ-ETL-007).
 *   4. On any thrown error: mark the run FAILED with the message in
 *      `errorSummary` (REQ-ETL-004). Products and metric are NOT written
 *      because they live outside the try block.
 *
 * Pure orchestration — does not know about HTTP, the browser, or the cron
 * library. The cron callback in main.ts calls this; tests call it directly.
 */
import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import {
  computeRunMetrics,
  buildQualityMetric,
} from '../observability/metrics';
import { EtlProductRepository } from '../persistence/etl-product.repository';
import type { ScrapedProduct } from './aliexpress.job';

export type TickResult =
  | { status: 'skipped' }
  | { status: 'completed'; runId: string }
  | { status: 'failed'; runId: string; error: Error };

export interface RunEtlTickDeps {
  prisma: PrismaClient;
  source: string;
  scrape: () => Promise<ScrapedProduct[]>;
  logger: pino.Logger;
}

/**
 * Run one ETL tick end-to-end. Resolves with a status describing what
 * happened. The function NEVER throws — cron callers expect a stable
 * contract so a single bad scrape can't kill the worker.
 */
export async function runEtlTick(deps: RunEtlTickDeps): Promise<TickResult> {
  const { prisma, source, scrape, logger } = deps;

  // ── 1. Idempotency gate ──────────────────────────────────────────
  const inFlight = await prisma.etlRun.findFirst({
    where: { source, status: 'RUNNING' },
  });
  if (inFlight) {
    logger.info(
      { source, inFlightRunId: inFlight.id },
      'skipping tick — previous run still in-flight',
    );
    return { status: 'skipped' };
  }

  // ── 2. Open a new run ─────────────────────────────────────────────
  const run = await prisma.etlRun.create({
    data: { source, status: 'RUNNING' },
  });
  const startedAt = new Date();
  logger.info({ runId: run.id, source }, 'etl tick started');

  // ── 3. Scrape → persist → metric → complete (with error gate) ────
  try {
    const products = await scrape();
    const endedAt = new Date();

    // Persist via the worker-side repository (reused from PR 1).
    // We intentionally do NOT reimplement upsert/$transaction here —
    // the repository owns the data layer.
    const productRepo = new EtlProductRepository(prisma);
    const rowsPersisted = await productRepo.persistProducts(
      run.id,
      products as never,
    );

    const metrics = computeRunMetrics({
      startedAt,
      endedAt,
      scrapedProducts: products,
      rowsPersisted,
    });
    await productRepo.createQualityMetric(run.id, buildQualityMetric(metrics));

    await prisma.etlRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        rowsScraped: metrics.rowsScraped,
        rowsPersisted: metrics.rowsPersisted,
        finishedAt: endedAt,
      },
    });

    logger.info(
      { runId: run.id, ...metrics },
      'etl tick completed',
    );
    return { status: 'completed', runId: run.id };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const endedAt = new Date();
    await prisma.etlRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorSummary: error.message,
        finishedAt: endedAt,
      },
    });
    logger.error(
      { runId: run.id, err: error.message },
      'etl tick failed',
    );
    return { status: 'failed', runId: run.id, error };
  }
}
