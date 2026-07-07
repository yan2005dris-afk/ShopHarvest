import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { EtlRunResponseDto } from './dto';

/**
 * EtlService — read-side queries over the EtlRun / EtlProduct / QualityMetric
 * tables created in PR 1.
 *
 * Per the design (`tasks.md → T-ETL-005`) the public endpoint is the latest
 * SUCCESSFUL run with its products and quality metric inlined. FAILED runs
 * are filtered out at the query level — they show up in the worker logs and
 * the EtlRun.errorSummary column, but the API never surfaces them.
 */
@Injectable()
export class EtlService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the most recent successful EtlRun, with products and quality
   * metric inlined. Returns null when no SUCCESS run exists so the
   * controller can surface a 404.
   */
  async findLatest(): Promise<EtlRunResponseDto | null> {
    return this.prisma.etlRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
      include: {
        etlProducts: true,
        qualityMetric: true,
      },
    }) as Promise<EtlRunResponseDto | null>;
  }
}
