import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import type { ScrapeListingDto } from './dto/scrape-listing.dto';
import type { SubmitResultDto } from './dto/submit-result.dto';

@Injectable()
export class ScrapingJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScrapingJobsService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async onModuleInit() {
    const url = this.configService.get<string>('rabbitmq.url')!;
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    const queue = this.configService.get<string>('rabbitmq.queue')!;
    await this.channel.assertQueue(queue, { durable: true });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  async enqueueJob(domainRuleId: string, url?: string) {
    // 1. Look up the DomainRule to get selectors
    const domainRule = await this.prisma.domainRule.findUnique({
      where: { id: domainRuleId },
    });

    if (!domainRule) {
      throw new Error(`DomainRule with id ${domainRuleId} not found`);
    }

    const targetUrl = url || domainRule.sampleUrl;
    if (!targetUrl) {
      throw new Error(`No URL provided and DomainRule ${domainRuleId} has no sampleUrl`);
    }

    // 2. Create a ScrapingJob record with status 'queued'
    const job = await this.prisma.scrapingJob.create({
      data: {
        domainRuleId,
        url: targetUrl,
        status: 'queued',
      },
    });

    // 3. Build message payload with selectors
    const selectors = {
      title: domainRule.selectorTitle,
      price: domainRule.selectorPrice,
      image: domainRule.selectorImage || undefined,
      sku: domainRule.selectorSku || undefined,
    };

    const message = JSON.stringify({
      jobId: job.id,
      url: targetUrl,
      domainRuleId,
      selectors,
      selectorType: domainRule.selectorType || 'css',
    });

    // 4. Send to RabbitMQ
    const queue = this.configService.get<string>('rabbitmq.queue')!;
    this.channel!.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
    });

    this.logger.log(`Enqueued scraping job ${job.id} for URL ${targetUrl}`);

    return job;
  }

  /**
   * Enqueue a listing scraping job. Snapshots fieldMappings into the message
   * so changes to the DomainRule later don't affect in-flight jobs.
   */
  async enqueueListing(dto: ScrapeListingDto) {
    const limit = dto.limit ?? 20;

    // 1. Validate DomainRule exists with containerSelector + fieldMappings
    const domainRule = await this.prisma.domainRule.findUnique({
      where: { id: dto.domainRuleId },
    });

    if (!domainRule) {
      throw new Error(`DomainRule with id ${dto.domainRuleId} not found`);
    }

    if (!domainRule.fieldMappings || !Array.isArray(domainRule.fieldMappings) || domainRule.fieldMappings.length === 0) {
      throw new Error(`DomainRule ${dto.domainRuleId} has no fieldMappings configured`);
    }

    if (!domainRule.containerSelector) {
      throw new Error(`DomainRule ${dto.domainRuleId} has no containerSelector configured`);
    }

    // 2. Create ScrapingJob with type='listing'
    const job = await this.prisma.scrapingJob.create({
      data: {
        domainRuleId: dto.domainRuleId,
        url: dto.url,
        type: 'listing',
        status: 'queued',
      },
    });

    // 3. Build message payload — snapshot fieldMappings + containerSelector
    const message = JSON.stringify({
      jobId: job.id,
      url: dto.url,
      domainRuleId: dto.domainRuleId,
      type: 'listing',
      limit,
      containerSelector: domainRule.containerSelector,
      fieldMappings: domainRule.fieldMappings,
      selectorType: domainRule.selectorType || 'css',
    });

    // 4. Send to RabbitMQ
    const queue = this.configService.get<string>('rabbitmq.queue')!;
    this.channel!.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
    });

    this.logger.log(`Enqueued listing job ${job.id} for URL ${dto.url} (limit: ${limit})`);

    return { id: job.id, status: job.status, type: job.type };
  }

  async submitResult(jobId: string, dto: SubmitResultDto) {
    const job = await this.prisma.scrapingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null; // controller returns 404
    }

    if (job.status === 'completed') {
      throw new Error('Job already completed'); // controller returns 409
    }

    if (dto.success) {
      // Update job status to completed and store result
      const updated = await this.prisma.scrapingJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result: dto as unknown as Prisma.InputJsonValue,
        },
      });

      // Handle listing results (batch of products)
      if (dto.type === 'listing' && dto.products && dto.products.length > 0) {
        let upserted = 0;
        let failed = 0;

        for (const product of dto.products) {
          try {
            await this.productsService.upsert({
              domainRuleId: job.domainRuleId,
              productUrl: product.productUrl || job.url,
              title: product.title || 'Unknown Product',
              price: product.price,
              currency: product.currency,
              imageUrl: product.imageUrl,
              sku: product.sku,
              description: product.description,
            });
            upserted++;
          } catch (err) {
            failed++;
            this.logger.error(
              `Failed to upsert listing product for job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        this.logger.log(`Listing job ${jobId}: ${upserted} products upserted, ${failed} failed`);
      } else {
        // Single product result (existing behavior)
        try {
          await this.productsService.upsert({
            domainRuleId: job.domainRuleId,
            productUrl: job.url,
            title: dto.title || 'Unknown Product',
            price: dto.price,
            currency: dto.currency,
            imageUrl: dto.imageUrl,
            sku: dto.sku,
            description: dto.description,
          });
        } catch (err) {
          this.logger.error(`Failed to upsert product for job ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return updated;
    } else {
      // Failed result — update job status to failed
      const updated = await this.prisma.scrapingJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: dto.error || 'Unknown error',
          result: dto as unknown as Prisma.InputJsonValue,
        },
      });

      this.logger.warn(`Job ${jobId} failed: ${dto.error}`);

      return updated;
    }
  }

  async findAll(status?: string, domainRuleId?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (domainRuleId) where.domainRuleId = domainRuleId;

    return this.prisma.scrapingJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { domainRule: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.scrapingJob.findUnique({
      where: { id },
      include: { domainRule: true },
    });
  }

  async findResult(id: string) {
    const job = await this.prisma.scrapingJob.findUnique({
      where: { id },
      select: { result: true },
    });
    return job?.result;
  }

  async findFailed() {
    return this.prisma.scrapingJob.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      include: { domainRule: true },
    });
  }

  async getQueueStatus() {
    const queue = this.configService.get<string>('rabbitmq.queue')!;
    const info = await this.channel!.checkQueue(queue);
    return {
      queue,
      messageCount: info.messageCount,
      consumerCount: info.consumerCount,
    };
  }
}
