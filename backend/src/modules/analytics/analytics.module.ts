import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { DwLoaderService } from './dw-loader.service';

/**
 * AnalyticsModule — BI surface backed by the `dw.*` schema.
 *
 * Imports nothing — relies on the global PrismaModule (which exports
 * `PrismaService` to every module in the app). This keeps the module
 * drop-in: register it once in `AppModule.imports` and all 12 endpoints
 * light up.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsQueryService, DwLoaderService],
  exports: [AnalyticsService, AnalyticsQueryService],
})
export class AnalyticsModule {}