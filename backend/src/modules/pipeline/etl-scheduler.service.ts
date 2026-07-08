import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class EtlSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EtlSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
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
   * Run one ETL tick end-to-end.
   * Leverages the same idempotency, scraping, and database persistence rules
   * previously handled by the external etl-worker.
   */
  async runEtlTick(): Promise<void> {
    const source = 'aliexpress';

    // 1. Idempotency gate: skip if a previous RUNNING run exists for this source
    const inFlight = await this.prisma.etlRun.findFirst({
      where: { source, status: 'RUNNING' },
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
    const startedAt = new Date();
    this.logger.log(`ETL run ${run.id} started.`);

    try {
      // 3. Stub: the bridge import was deleted in PR 1a; the actual
      //    scraper wiring (AliExpressAdapter → STAGING_PROCESSOR →
      //    QualityService → DW_LOADER) lands across PR 3, PR 4, and
      //    PR 6. Until then the run is created, the throw fires, and
      //    the catch marks the run as FAILED — no runtime crash.
      void run;
      void startedAt;
      this.logger.warn(
        'etl-scheduler: native scraper not wired yet; see PR 3 (MELI), PR 4 (AliExpress), PR 6 (ETL)',
      );
      throw new Error(
        'etl-scheduler: native scraper not wired yet; see PR 3 (MELI), PR 4 (AliExpress), PR 6 (ETL)',
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const endedAt = new Date();

      // Update run status to FAILED and store the error summary
      await this.prisma.etlRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorSummary: error.message,
          finishedAt: endedAt,
        },
      });

      this.logger.error(`ETL run ${run.id} failed: ${error.message}`);
    }
  }
}
