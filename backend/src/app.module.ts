import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuthModule } from './modules/operational/auth/auth.module';
import { JwtAuthGuard } from './modules/operational/auth/common/jwt-auth.guard';
import { DomainsModule } from './modules/operational/domains/domains.module';
import { ProductsModule } from './modules/operational/products/products.module';
import { SourcesModule } from './modules/operational/sources/sources.module';
import { CategoriesModule } from './modules/operational/categories/categories.module';
import { BrandsModule } from './modules/operational/brands/brands.module';
import { RawCapturesModule } from './modules/operational/raw-captures/raw-captures.module';
import { AnalyticsModule } from './modules/analytics/analytics/analytics.module';
import { PipelineModule } from './modules/etl/pipeline/pipeline.module';
import { ScheduleModule } from '@nestjs/schedule';

// ScrapingJobsModule and SchedulesModule were removed in review batch 4. They
// modelled a headless-worker pipeline that no longer exists (the worker was
// replaced by the browser extension). Automated re-scraping is handled by
// chrome.alarms in the extension (batch 5). The AppController/AppService
// "Hello World" boilerplate was dropped in the same batch.
//
// Batch 6 (C2): JwtAuthGuard is registered globally, so every route requires a
// valid JWT unless marked @Public(). This closes the open API that let any
// extension POST/DELETE.
//
// Slice 3: HttpExceptionFilter is registered via APP_FILTER so every
// uncaught failure becomes an RFC 7807 problem-details envelope without
// per-controller decoration.
//
// Cambio SDD: bi-dashboard-analytics. AnalyticsModule expone los 12
// endpoints REST bajo /api/analytics/*. Toda la superficie es @Public()
// para que el dashboard Vercel pueda consumirla sin JWT (requisito
// "URL pública" del Entregable 5).
//
// Cambio SDD: pipeline-consolidation. PipelineModule was implemented
// across PRs 1-4 but never imported here — the controller and ETL
// cron were dead code at runtime until this line. Wired in once the
// MELI/AliExpress adapters had real (non-stub) implementations.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    DomainsModule,
    ProductsModule,
    SourcesModule,
    CategoriesModule,
    BrandsModule,
    RawCapturesModule,
    AnalyticsModule,
    PipelineModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
