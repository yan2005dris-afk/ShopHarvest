/**
 * Prisma client factory for the ETL worker.
 *
 * Mirrors the adapter pattern from `backend/src/common/prisma/prisma.service.ts:11`
 * but is plain TypeScript — no NestJS dependency. The worker creates its own
 * client instance and is responsible for $connect() / $disconnect() lifecycle.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createWorkerPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl) {
    throw new Error('createWorkerPrismaClient requires a non-empty DATABASE_URL');
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}