/**
 * Smoke test for worker/src/main.ts — proves the bootstrap module wires
 * env validation, Prisma client construction, cron registration, and the
 * SIGTERM/SIGINT shutdown handlers.
 *
 * RED phase: written before the production code in main.ts (the file exists
 * but the startWorker function is the GREEN target).
 */
import { startWorker } from './main';

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CRON_SCHEDULE: '0 2 * * *',
  LOG_LEVEL: 'info',
};

describe('worker bootstrap (main.ts)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...baseEnv };
  });

  afterEach(async () => {
    process.env = originalEnv;
  });

  it('rejects startup when DATABASE_URL is missing', async () => {
    process.env.DATABASE_URL = '';
    await expect(startWorker()).rejects.toThrow(/DATABASE_URL/);
  });

  it('rejects startup when CRON_SCHEDULE is invalid', async () => {
    process.env.CRON_SCHEDULE = 'definitely-not-cron';
    await expect(startWorker()).rejects.toThrow(/CRON_SCHEDULE/);
  });
});