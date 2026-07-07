/**
 * Worker bootstrap.
 *
 * Validates env vars, opens a Prisma connection, registers the cron schedule,
 * and wires SIGTERM/SIGINT handlers so the process exits cleanly without
 * interrupting an in-flight scraper run.
 *
 * On every cron tick, dispatches the ETL pipeline (`runEtlTick`) which is
 * responsible for the in-flight idempotency check, the scrape → persist →
 * metrics → complete sequence, and the FAILED-state write on error.
 */
import cron from 'node-cron';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { runEtlTick } from './jobs/run-pipeline';
import { runAliexpressScrape } from './jobs/aliexpress.job';

export const ETL_SOURCE = 'aliexpress';

export interface WorkerHandle {
  prisma: PrismaClient;
  logger: ReturnType<typeof createLogger>;
  stop: () => Promise<void>;
}

/**
 * Build the worker runtime. Throws synchronously if env vars are invalid so
 * the process exits with a clear error before scheduling anything.
 */
export async function startWorker(): Promise<WorkerHandle> {
  const cfg = loadConfig();
  const logger = createLogger(cfg.logLevel);

  const adapter = new PrismaPg({ connectionString: cfg.databaseUrl });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  logger.info({ schedule: cfg.cronSchedule }, 'worker connected to postgres');

  // The cron tick delegates to runEtlTick. The function handles:
  //   - in-flight idempotency (skips if a previous RUNNING run exists)
  //   - happy path: createRun → scrape → persistProducts → metrics → complete
  //   - failure path: failRun with the error message
  // We never `await` the tick inside cron.schedule — node-cron will keep
  // firing every minute even if the previous tick is still running, but
  // runEtlTick's idempotency gate guarantees only one effective run.
  const task = cron.schedule(cfg.cronSchedule, () => {
    runEtlTick({
      prisma,
      source: ETL_SOURCE,
      scrape: runAliexpressScrape,
      logger,
    }).catch((err) => {
      logger.error({ err }, 'etl tick crashed unexpectedly');
    });
  });

  let stopping = false;
  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('shutdown signal received');
    task.stop();
    await prisma.$disconnect();
    logger.info('worker stopped cleanly');
  };

  process.once('SIGTERM', () => {
    stop()
      .then(() => process.exit(0))
      .catch((err) => {
        logger.error({ err }, 'shutdown failed');
        process.exit(1);
      });
  });
  process.once('SIGINT', () => {
    stop()
      .then(() => process.exit(0))
      .catch((err) => {
        logger.error({ err }, 'shutdown failed');
        process.exit(1);
      });
  });

  return { prisma, logger, stop };
}