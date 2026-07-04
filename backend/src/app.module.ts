import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { DomainsModule } from './modules/domains/domains.module';
import { ProductsModule } from './modules/products/products.module';

// ScrapingJobsModule and SchedulesModule were removed in review batch 4. They
// modelled a headless-worker pipeline that no longer exists (the worker was
// replaced by the browser extension). Automated re-scraping is handled by
// chrome.alarms in the extension (batch 5). The AppController/AppService
// "Hello World" boilerplate was dropped in the same batch.
//
// Batch 6 (C2): JwtAuthGuard is registered globally, so every route requires a
// valid JWT unless marked @Public(). This closes the open API that let any
// extension POST/DELETE.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    PrismaModule,
    AuthModule,
    DomainsModule,
    ProductsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
