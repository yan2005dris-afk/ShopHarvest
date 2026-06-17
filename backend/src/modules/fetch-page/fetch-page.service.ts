import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateFetchRequestDto, FetchResultDto } from './dto';

@Injectable()
export class FetchPageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FetchPageService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const url = this.configService.get<string>('rabbitmq.url')!;
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    const queue = this.configService.get<string>('rabbitmq.pageFetchQueue')!;
    await this.channel.assertQueue(queue, { durable: true });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  /**
   * Create a FetchRequest and publish to the page-fetch queue.
   */
  async createFetchRequest(dto: CreateFetchRequestDto) {
    // 1. Create FetchRequest record
    const request = await this.prisma.fetchRequest.create({
      data: {
        url: dto.url,
        status: 'queued',
      },
    });

    // 2. Publish message to page-fetch queue
    const message = JSON.stringify({
      requestId: request.id,
      url: dto.url,
      cookies: dto.cookies,
    });

    const queue = this.configService.get<string>('rabbitmq.pageFetchQueue')!;
    this.channel!.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
    });

    this.logger.log(`Enqueued fetch-page request ${request.id} for URL ${dto.url}`);

    return { id: request.id, status: request.status };
  }

  /**
   * Get fetch request status with optional result.
   */
  async getFetchRequest(id: string) {
    const request = await this.prisma.fetchRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`FetchRequest with id ${id} not found`);
    }

    const response: {
      id: string;
      url: string;
      status: string;
      result?: unknown;
      captchaDetected?: boolean;
      errorMessage?: string;
    } = {
      id: request.id,
      url: request.url,
      status: request.status,
    };

    // If status is 'captcha', signal it to the frontend
    if (request.status === 'captcha') {
      response.captchaDetected = true;
    }

    if (request.result) {
      response.result = request.result;
    }
    if (request.errorMessage) {
      response.errorMessage = request.errorMessage;
    }

    return response;
  }

  /**
   * Worker callback: update FetchRequest with result.
   */
  async submitResult(id: string, dto: FetchResultDto) {
    const request = await this.prisma.fetchRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`FetchRequest with id ${id} not found`);
    }

    if (dto.success) {
      const updated = await this.prisma.fetchRequest.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result: {
            html: dto.html,
            title: dto.title,
            screenshot: dto.screenshot,
            viewport: dto.viewport,
            detectedElements: dto.detectedElements,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`FetchRequest ${id} completed`);
      return { id: updated.id, status: updated.status };
    } else if (dto.captchaDetected) {
      // CAPTCHA: set a dedicated status so the frontend can show the captcha UI
      const updated = await this.prisma.fetchRequest.update({
        where: { id },
        data: {
          status: 'captcha',
          completedAt: new Date(),
          errorMessage: dto.error || 'CAPTCHA detected',
        },
      });

      this.logger.warn(`FetchRequest ${id} blocked by CAPTCHA`);
      return { id: updated.id, status: updated.status };
    } else {
      const updated = await this.prisma.fetchRequest.update({
        where: { id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: dto.error || 'Unknown error',
        },
      });

      this.logger.warn(`FetchRequest ${id} failed: ${dto.error}`);
      return { id: updated.id, status: updated.status };
    }
  }
}
