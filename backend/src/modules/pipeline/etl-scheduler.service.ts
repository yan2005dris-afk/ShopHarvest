import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';
import { PipelineService } from './pipeline.service';
import { PipelineSource } from '@web-scraping/contracts/pipeline';

/**
 * A single tick fans out to every registered scraper, then runs
 * staging → quality → DW load as one batch (`PipelineService.runAll`).
 * `EtlRun.source` is a single free-form string column, not an FK, so
 * 'all' is used as the tick-level label — the per-source outcomes
 * live in the returned `PipelineRunSummary.scrapeResults`, logged but
 * not persisted per-source (no schema change in this change, per ETL-5).
 */
const TICK_SOURCE_LABEL = 'all';

@Injectable()
export class EtlSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EtlSchedulerService.name);

  constructor(
    private readonly prisma: OperationalPrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly pipelineService: PipelineService,
  ) {}

  onModuleInit() {
    // Schedule the ETL tick based on CRON_SCHEDULE or ETL_CRON_SCHEDULE environment variable,
    // defaulting to every day at 2:00 AM (0 2 * * *).
    const cronTime =
      process.env.CRON_SCHEDULE || process.env.ETL_CRON_SCHEDULE || '0 2 * * *';

    try {
      const job = new CronJob(cronTime, () => {
        this.runEtlTick().catch((err) => {
          this.logger.error('ETL tick crashed unexpectedly', err);
        });
      });

      this.schedulerRegistry.addCronJob('etl-tick', job);
      job.start();
      this.logger.log(`ETL scheduler initialized with schedule: ${cronTime}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to register ETL cron job with expression "${cronTime}": ${message}`,
      );
    }
  }

  /**
   * Run one ETL tick end-to-end: scrape every source → staging →
   * quality gate → DW load (`PipelineService.runAll`). Preserves the
   * 4-state `EtlRun` lifecycle (ETL-5): `queued` has no row yet,
   * `running` on create, `success`/`failed` on completion.
   */
  async runEtlTick(options?: { action: 'full' | 'local'; source?: string }): Promise<void> {
    const action = options?.action ?? 'full';
    const sourceParam = options?.source ?? 'all';

    // Define source label for etlRun table
    // For 'local' action, source is 'pending' (all pending captures)
    // For 'full' action, source is the actual source parameter
    const source = action === 'local' ? 'pending' : sourceParam;

    // 1. Idempotency gate: skip if a previous RUNNING run exists.
    const inFlight = await this.prisma.etlRun.findFirst({
      where: { status: 'RUNNING' },
    });
    if (inFlight) {
      this.logger.warn(
        `Skipping ETL tick: previous run ${inFlight.id} is still in-flight.`,
      );
      return;
    }

    // 2. Start a new run in RUNNING status
    const run = await this.prisma.etlRun.create({
      data: { source, status: 'RUNNING' },
    });
    this.logger.log(`ETL run ${run.id} started (action: ${action}, source: ${source}).`);

    try {
      let rowsScraped = 0;
      let scrapeErrors: string[] = [];
      let loadResult: any;

      if (action === 'local') {
        // Run only Staging & DW Load (process pending operational captures)
        this.logger.log(`ETL run ${run.id}: running Staging for source ${sourceParam}...`);
        const stagingResult = await this.pipelineService.runStaging({ source: sourceParam });
        this.logger.log(`ETL run ${run.id}: running DW Loader...`);
        loadResult = await this.pipelineService.loadDw({
          inMemoryData: {
            productos: stagingResult.productos,
            encuestas: stagingResult.encuestas,
          },
        });
      } else {
        // Run Scraping + Staging + DW Load (either all or specific source)
        const runOpts = sourceParam !== 'all' ? { sources: [sourceParam as PipelineSource] } : undefined;
        const summary = await this.pipelineService.runAll(runOpts);
        
        rowsScraped = summary.scrapeResults.reduce(
          (acc, r) => acc + r.totalScraped,
          0,
        );
        scrapeErrors = summary.scrapeResults
          .filter((r) => r.errors.length > 0)
          .map((r) => `${r.source}: ${r.errors.join('; ')}`);
          
        for (const r of summary.scrapeResults) {
          this.logger.log(
            `  scrape ${r.source}: items=${r.totalScraped} errors=${r.errors.length}`,
          );
        }
        loadResult = summary.loadResult;
      }

      const rowsPersisted = loadResult
        ? loadResult.productosCargados + loadResult.encuestasCargadas
        : 0;
      const dwFailed = !loadResult || loadResult.estado === 'fallido';

      const errorSummary = dwFailed
        ? [loadResult?.error, ...scrapeErrors]
            .filter(Boolean)
            .join(' | ')
            .slice(0, 2000)
        : (scrapeErrors.length > 0 ? scrapeErrors.join(' | ').slice(0, 2000) : undefined);

      await this.prisma.etlRun.update({
        where: { id: run.id },
        data: {
          status: dwFailed ? 'FAILED' : 'SUCCESS',
          rowsScraped,
          rowsPersisted,
          errorSummary: errorSummary || null,
          finishedAt: new Date(),
        },
      });

      if (dwFailed) {
        this.logger.error(`ETL run ${run.id} failed: ${errorSummary}`);
      } else {
        this.logger.log(
          `ETL run ${run.id} succeeded: scraped=${rowsScraped} persisted=${rowsPersisted}`,
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await this.prisma.etlRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorSummary: error.message.slice(0, 2000),
          finishedAt: new Date(),
        },
      });
      this.logger.error(`ETL run ${run.id} failed: ${error.message}`);
    }
  }
}
