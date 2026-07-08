import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { runAliExpressScrape } from './pipeline-scripts-bridge';

interface ScrapedItem {
  titulo: string;
  precio: string;
  moneda: string;
  rating: string;
  disponibilidad: string;
  categoria: string;
}

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
    const cronTime = process.env.CRON_SCHEDULE || process.env.ETL_CRON_SCHEDULE || '0 2 * * *';
    
    try {
      const job = new CronJob(cronTime, () => {
        this.runEtlTick().catch((err) => {
          this.logger.error('ETL tick crashed unexpectedly', err);
        });
      });
      
      this.schedulerRegistry.addCronJob('etl-tick', job);
      job.start();
      this.logger.log(`ETL scheduler initialized with schedule: ${cronTime}`);
    } catch (err: any) {
      this.logger.error(`Failed to register ETL cron job with expression "${cronTime}":`, err.message);
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
      this.logger.warn(`Skipping ETL tick: previous run ${inFlight.id} is still in-flight.`);
      return;
    }

    // 2. Start a new run in RUNNING status
    const run = await this.prisma.etlRun.create({
      data: { source, status: 'RUNNING' },
    });
    const startedAt = new Date();
    this.logger.log(`ETL run ${run.id} started.`);

    try {
      // 3. Trigger the scraper via the bridge
      const scrapeResult = await runAliExpressScrape({
        source: PipelineSource.ALIEXPRESS,
        outputDir: 'pipeline/raw/scraping/aliexpress',
      });

      if (scrapeResult.errors && scrapeResult.errors.length > 0) {
        throw new Error(`Scraper errors: ${scrapeResult.errors.join('; ')}`);
      }

      // 4. Read the raw products JSON from the output file
      if (!fs.existsSync(scrapeResult.outputPath)) {
        throw new Error(`Scrape output file not found at: ${scrapeResult.outputPath}`);
      }
      const rawData: ScrapedItem[] = JSON.parse(fs.readFileSync(scrapeResult.outputPath, 'utf8'));

      // 5. Map the raw products to database fields and generate unique sourceId
      const mappedProducts = rawData.map((item) => {
        const cleanTitle = item.titulo || 'Untitled';
        const slug = cleanTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const sourceId = `${item.categoria || 'general'}:${slug}`;
        const price = item.precio ? parseFloat(item.precio.replace(/[^0-9.]/g, '')) : null;

        return {
          sourceId,
          title: cleanTitle,
          price: isNaN(price as number) ? null : price,
          currency: item.moneda || 'GBP',
          availability: item.disponibilidad || null,
          rawJson: item,
          scrapedAt: new Date(),
        };
      });

      // 6. Persist products idempotently via a single transaction (upsert)
      const rowsPersisted = await this.prisma.$transaction(async (tx) => {
        let count = 0;
        for (const product of mappedProducts) {
          await tx.etlProduct.upsert({
            where: {
              source_sourceId: { source, sourceId: product.sourceId },
            },
            create: {
              etlRunId: run.id,
              source,
              sourceId: product.sourceId,
              title: product.title,
              price: product.price,
              currency: product.currency,
              availability: product.availability,
              rawJson: product.rawJson as any,
              scrapedAt: product.scrapedAt,
            },
            update: {
              etlRunId: run.id,
              title: product.title,
              price: product.price,
              currency: product.currency,
              availability: product.availability,
              rawJson: product.rawJson as any,
              scrapedAt: product.scrapedAt,
            },
          });
          count += 1;
        }
        return count;
      });

      // 7. Calculate quality metrics
      const endedAt = new Date();
      const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
      const completenessPct = mappedProducts.length > 0
        ? Math.round((rowsPersisted / mappedProducts.length) * 10000) / 100
        : 0;

      // Save the quality metric record
      await this.prisma.qualityMetric.create({
        data: {
          etlRunId: run.id,
          completenessPct,
          duplicatesRemoved: 0,
          checks: {},
        },
      });

      // 8. Mark ETL run as SUCCESS
      await this.prisma.etlRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          rowsScraped: mappedProducts.length,
          rowsPersisted,
          finishedAt: endedAt,
        },
      });

      this.logger.log(
        `ETL run ${run.id} completed successfully. Scraped: ${mappedProducts.length}, Persisted: ${rowsPersisted}, Duration: ${durationMs}ms`,
      );
    } catch (err: any) {
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
