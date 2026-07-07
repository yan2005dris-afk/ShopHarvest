/**
 * Tests for the Prisma schema additions (EtlRun, EtlProduct, QualityMetric).
 *
 * RED phase: schema has NOT been extended yet. These tests assert that the
 * generated Prisma client exposes the new enum and model types. They fail
 * (compile-time) until `prisma generate` runs against the extended schema.
 *
 * We assert via the `Prisma` namespace instead of instantiating `PrismaClient`
 * because Prisma 7.8 requires a valid adapter — no point constructing a real
 * client just to verify the generated types are present.
 */
import { EtlRunStatus, Prisma } from '@prisma/client';

describe('Prisma schema — EtlRunStatus enum', () => {
  it('exposes the RUNNING value', () => {
    expect(EtlRunStatus.RUNNING).toBe('RUNNING');
  });

  it('exposes the SUCCESS value', () => {
    expect(EtlRunStatus.SUCCESS).toBe('SUCCESS');
  });

  it('exposes the FAILED value', () => {
    expect(EtlRunStatus.FAILED).toBe('FAILED');
  });

  it('has exactly three values (no extras)', () => {
    expect(Object.values(EtlRunStatus).sort()).toEqual(['FAILED', 'RUNNING', 'SUCCESS']);
  });

  it('is usable as a string-literal type via the Prisma namespace', () => {
    // Prisma.EtlRunScalarFieldEnum-style keys confirm the model is in the
    // generated schema. We use `as unknown` here because the namespace
    // presence is what we are asserting — strict type narrowing is not the point.
    const ns = Prisma as unknown as Record<string, unknown>;
    expect(ns.EtlRunScalarFieldEnum).toBeDefined();
  });
});

describe('Prisma schema — new ETL model types', () => {
  it('exposes EtlRun model type', () => {
    const ns = Prisma as unknown as Record<string, unknown>;
    expect(ns.EtlRunScalarFieldEnum).toBeDefined();
  });

  it('exposes EtlProduct model type', () => {
    const ns = Prisma as unknown as Record<string, unknown>;
    expect(ns.EtlProductScalarFieldEnum).toBeDefined();
  });

  it('exposes QualityMetric model type', () => {
    const ns = Prisma as unknown as Record<string, unknown>;
    expect(ns.QualityMetricScalarFieldEnum).toBeDefined();
  });
});