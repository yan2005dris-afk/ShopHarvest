/**
 * Repository for EtlProduct + QualityMetric writes.
 *
 * `persistProducts` is the idempotency gate (REQ-ETL-003): all upserts run
 * inside a single `$transaction` keyed on the `(source, sourceId)` unique
 * constraint. Re-running the same scraper updates existing rows instead of
 * duplicating them.
 */
import type { PrismaClient } from '@prisma/client';

export const ETL_SOURCE = 'aliexpress';

export interface ScrapedProductInput {
  sourceId: string;
  title: string;
  price?: number | null;
  currency?: string;
  availability?: string | null;
  rawJson?: unknown;
  scrapedAt?: Date;
}

export interface QualityCheck {
  completenessPct: number;
  duplicatesRemoved?: number;
  checks: Record<string, { passed: number; failed: number }>;
}

export class EtlProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async persistProducts(runId: string, products: ScrapedProductInput[]): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const product of products) {
        await tx.etlProduct.upsert({
          where: {
            source_sourceId: { source: ETL_SOURCE, sourceId: product.sourceId },
          },
          create: {
            etlRunId: runId,
            source: ETL_SOURCE,
            sourceId: product.sourceId,
            title: product.title,
            price: product.price ?? null,
            currency: product.currency ?? 'GBP',
            availability: product.availability ?? null,
            rawJson: (product.rawJson ?? {}) as object,
            scrapedAt: product.scrapedAt ?? new Date(),
          },
          update: {
            etlRunId: runId,
            title: product.title,
            price: product.price ?? null,
            currency: product.currency ?? 'GBP',
            availability: product.availability ?? null,
            rawJson: (product.rawJson ?? {}) as object,
            scrapedAt: product.scrapedAt ?? new Date(),
          },
        });
        count += 1;
      }
      return count;
    });
  }

  async createQualityMetric(runId: string, metric: QualityCheck): Promise<void> {
    await this.prisma.qualityMetric.create({
      data: {
        etlRunId: runId,
        completenessPct: metric.completenessPct,
        duplicatesRemoved: metric.duplicatesRemoved ?? 0,
        checks: metric.checks as object,
      },
    });
  }
}