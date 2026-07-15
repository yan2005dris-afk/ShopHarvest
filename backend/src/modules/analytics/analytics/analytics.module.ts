import { Module } from '@nestjs/common';
import { KpisService } from './application/kpis.service';
import { QueriesService } from './application/queries.service';
import { DwLoaderService } from './application/dw-loader.service';
import { AnalyticsHttpController } from './infrastructure/http/analytics-http.controller';
import { PipelineModule } from '../../etl/pipeline/pipeline.module';

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
 *     AnalyticsHttpController.load endpoint already exposes.
 *
 * Application services (KpisService, QueriesService, DwLoaderService)
 * live in the `application/` layer. The HTTP adapter is in
 * `infrastructure/http/`.
 */
@Module({
  imports: [PipelineModule],
  controllers: [AnalyticsHttpController],
  providers: [KpisService, QueriesService, DwLoaderService],
  exports: [KpisService, QueriesService, DwLoaderService],
})
export class AnalyticsModule {}
