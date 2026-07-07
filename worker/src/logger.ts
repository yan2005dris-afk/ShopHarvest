/** Pino JSON logger — structured output to stdout for container log drivers. */
import pino, { Logger } from 'pino';
import type { pinoLevel } from './config';

export function createLogger(level: pinoLevel): Logger {
  return pino({ level, timestamp: pino.stdTimeFunctions.isoTime });
}

export type { Logger };