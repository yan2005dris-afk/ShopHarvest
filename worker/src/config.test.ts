/**
 * Tests for worker/src/config.ts — env validation.
 *
 * RED phase: written before any production code for the config module
 * (the module existed at file-write time but loadConfig throws different
 * errors than these tests assert — the implementation is the GREEN pass).
 */
import { loadConfig } from './config';

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CRON_SCHEDULE: '0 2 * * *',
  LOG_LEVEL: 'info',
};

describe('loadConfig', () => {
  it('returns a config object when all required vars are set', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.databaseUrl).toBe(baseEnv.DATABASE_URL);
    expect(cfg.cronSchedule).toBe(baseEnv.CRON_SCHEDULE);
    expect(cfg.logLevel).toBe('info');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('throws when CRON_SCHEDULE is missing', () => {
    expect(() => loadConfig({ ...baseEnv, CRON_SCHEDULE: '' })).toThrow(/CRON_SCHEDULE/);
  });

  it('throws when CRON_SCHEDULE is not a valid cron expression', () => {
    expect(() => loadConfig({ ...baseEnv, CRON_SCHEDULE: 'not-a-cron' })).toThrow(
      /CRON_SCHEDULE/,
    );
  });

  it('defaults LOG_LEVEL to "info" when not provided', () => {
    const env = { DATABASE_URL: baseEnv.DATABASE_URL, CRON_SCHEDULE: baseEnv.CRON_SCHEDULE } as NodeJS.ProcessEnv;
    const cfg = loadConfig(env);
    expect(cfg.logLevel).toBe('info');
  });

  it('throws on unknown LOG_LEVEL values', () => {
    expect(() => loadConfig({ ...baseEnv, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  it('accepts the standard UTC 02:00 daily cron expression', () => {
    const cfg = loadConfig({ ...baseEnv, CRON_SCHEDULE: '0 2 * * *' });
    expect(cfg.cronSchedule).toBe('0 2 * * *');
  });
});