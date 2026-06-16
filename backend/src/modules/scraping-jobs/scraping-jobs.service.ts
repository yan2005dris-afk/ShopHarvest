import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class ScrapingJobsService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly configService: ConfigService) {}

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
    const queue = this.configService.get<string>('rabbitmq.queue')!;
    const message = JSON.stringify({ domainRuleId, url, timestamp: new Date() });

    this.channel!.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
    });

    return { queued: true, domainRuleId, url };
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
