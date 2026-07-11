import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { DwLoaderService } from './dw-loader.service';
import { PipelineModule } from '../pipeline/pipeline.module';

/**
 * AnalyticsModule — BI surface backed by the `dw.*` schema.
 *
 * After the Ports & Adapters refactor (E5 deliverable):
 *   - The ETL implementation lives in `DwLoaderAdapter` (under
 *     PipelineModule). We import PipelineModule here so its
 *     `DW_LOADER` token is in the DI container when DwLoaderService
 *     is constructed.
 *   - DwLoaderService is now a thin shim over IDwLoader that maps
 *     the camelCase LoadResult back to the snake_case envelope the
 *     AnalyticsController.load endpoint already exposes.
 *
 * Everything else (controller, services, queries) is untouched.
 */
@Module({
  imports: [PipelineModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsQueryService, DwLoaderService],
  exports: [AnalyticsService, AnalyticsQueryService, DwLoaderService],
})
export class AnalyticsModule {}
