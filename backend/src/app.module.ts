import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { DomainsModule } from './modules/domains/domains.module';
import { ProductsModule } from './modules/products/products.module';

// ScrapingJobsModule and SchedulesModule were removed in review batch 4. They
// modelled a headless-worker pipeline that no longer exists (the worker was
// replaced by the browser extension). Automated re-scraping is handled by
// chrome.alarms in the extension (batch 5). The AppController/AppService
// "Hello World" boilerplate was dropped in the same batch.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    PrismaModule,
    DomainsModule,
    ProductsModule,
  ],
})
export class AppModule {}
