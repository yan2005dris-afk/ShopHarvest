/**
 * Worker environment configuration.
 *
 * Reads and validates the three required env vars at boot so the worker
 * fails fast if anything is missing. Centralized here so `main.ts` and the
 * job modules share the same contract.
 */
import * as nodeCron from 'node-cron';

export interface WorkerConfig {
  databaseUrl: string;
  cronSchedule: string;
  logLevel: pinoLevel;
}

export type pinoLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const VALID_LEVELS: pinoLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

/**
 * Read env vars and return a validated config object. Throws on any missing
 * or malformed value so the worker exits before scheduling anything.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required');
  }

  const cronSchedule = env.CRON_SCHEDULE;
  if (!cronSchedule || cronSchedule.trim() === '') {
    throw new Error('CRON_SCHEDULE is required');
  }
  if (!nodeCron.validate(cronSchedule)) {
    throw new Error(`CRON_SCHEDULE is not a valid cron expression: ${cronSchedule}`);
  }

  const logLevel = (env.LOG_LEVEL ?? 'info') as pinoLevel;
  if (!VALID_LEVELS.includes(logLevel)) {
    throw new Error(
      `LOG_LEVEL must be one of ${VALID_LEVELS.join(', ')} (got: ${env.LOG_LEVEL})`,
    );
  }

  return { databaseUrl, cronSchedule, logLevel };
}