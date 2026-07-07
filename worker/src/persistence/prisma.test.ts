/**
 * Tests for the Prisma client factory used by the ETL worker.
 *
 * RED phase: the factory module does not exist yet. After this test runs and
 * fails, the GREEN implementation creates `new PrismaClient({ adapter })`
 * mirroring `backend/src/common/prisma/prisma.service.ts:11`.
 */
import { createWorkerPrismaClient } from './prisma';

describe('createWorkerPrismaClient', () => {
  it('returns a PrismaClient instance', () => {
    const client = createWorkerPrismaClient('postgresql://user:pass@localhost:5432/db');
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$disconnect).toBe('function');
    expect(typeof client.$transaction).toBe('function');
  });

  it('throws when DATABASE_URL is empty or missing', () => {
    expect(() => createWorkerPrismaClient('')).toThrow();
  });
});