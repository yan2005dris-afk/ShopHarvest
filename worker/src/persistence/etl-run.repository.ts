/**
 * Repository for EtlRun records — run lifecycle (create → complete | fail).
 *
 * The cron tick calls `getInFlightRun` first to skip a run that is already
 * RUNNING (REQ-ETL-002). After scraping completes, `completeRun` writes the
 * final stats; on error, `failRun` records the error summary.
 */
import type { EtlRun, PrismaClient } from '@prisma/client';

export type EtlRunStatusLike = 'RUNNING' | 'SUCCESS' | 'FAILED';

export class EtlRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRun(source: string): Promise<EtlRun> {
    return this.prisma.etlRun.create({
      data: { source, status: 'RUNNING' },
    });
  }

  async completeRun(runId: string, rowsScraped: number, rowsPersisted: number): Promise<void> {
    await this.prisma.etlRun.update({
      where: { id: runId },
      data: {
        status: 'SUCCESS',
        rowsScraped,
        rowsPersisted,
        finishedAt: new Date(),
      },
    });
  }

  async failRun(runId: string, error: Error): Promise<void> {
    await this.prisma.etlRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        errorSummary: error.message,
        finishedAt: new Date(),
      },
    });
  }

  async getInFlightRun(source: string): Promise<EtlRun | null> {
    return this.prisma.etlRun.findFirst({
      where: { source, status: 'RUNNING' },
    });
  }
}