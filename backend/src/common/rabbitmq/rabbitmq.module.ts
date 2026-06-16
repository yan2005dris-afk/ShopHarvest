import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import rabbitmqConfig from './rabbitmq.config';

@Module({
  imports: [ConfigModule.forFeature(rabbitmqConfig)],
  exports: [ConfigModule],
})
export class RabbitmqModule {}
