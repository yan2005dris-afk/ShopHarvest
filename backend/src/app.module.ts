import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { RabbitmqModule } from './common/rabbitmq/rabbitmq.module';
import { DomainsModule } from './modules/domains/domains.module';
import { ProductsModule } from './modules/products/products.module';
import { ScrapingJobsModule } from './modules/scraping-jobs/scraping-jobs.module';
import rabbitmqConfig from './common/rabbitmq/rabbitmq.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [rabbitmqConfig],
    }),
    PrismaModule,
    RabbitmqModule,
    DomainsModule,
    ProductsModule,
    ScrapingJobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
