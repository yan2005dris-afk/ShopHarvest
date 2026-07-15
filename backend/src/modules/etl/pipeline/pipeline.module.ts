import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  DW_LOADER,
  DATA_SOURCES,
  STAGING_PROCESSOR,
} from '@web-scraping/contracts/pipeline';
import { PipelineController } from './infrastructure/http/pipeline-http.controller';
import { PipelineService } from './application/pipeline.service';
import { SseAuthGuard } from './guards/sse-auth.guard';
import { DwLoaderAdapter } from './adapters/dw-loader.adapter';
import { StagingProcessorAdapter } from './adapters/staging-processor.adapter';
import { EtlSchedulerService } from './application/etl-scheduler.service';
import { BrowserFactoryService } from './scraping/browser-factory.service';
import { QualityService } from './etl/quality.service';
import { StagingProcessorService } from './etl/staging-processor.service';
import { DwLoaderService } from './etl/dw-loader.service';
import {
  MercadoLibreAdapter,
  AliExpressAdapter,
  TemuAdapter,
  SheinAdapter,
  ApiRateAdapter,
  CsvAdapter,
  EncuestaAdapter,
} from './adapters/data-sources';

/**
 * PipelineModule — registers all port implementations and wires them
 * to the three DI tokens defined in @web-scraping/contracts/pipeline:
 *
 *   - DW_LOADER       → DwLoaderAdapter (useExisting alias)
 *   - DATA_SOURCES    → factory returning [Meli, Ali, Temu, Shein, ApiRate, Csv, Encuesta]
 *   - STAGING_PROCESSOR → StagingProcessorAdapter
 *
 * Use `useExisting` for the singleton-shaped ports so consumers can
 * request either the concrete class or the symbol and reach the same
 * instance.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [PipelineController],
  providers: [
    PipelineService,
    EtlSchedulerService,
    SseAuthGuard,
    // BrowserFactoryService — singleton, stealth always-on, proxy opt-in
    // Consumed by Playwright-based scrapers (MELI/AliExpress in PR 3/4).
    // Extension-based scrapers (Temu/Shein in PR 5) MUST NOT inject it.
    BrowserFactoryService,
    // ETL native services (PR 6) — consumed by the adapters below.
    QualityService,
    StagingProcessorService,
    DwLoaderService,
    // DW loader — by class + alias
    DwLoaderAdapter,
    { provide: DW_LOADER, useExisting: DwLoaderAdapter },
    // Staging — by class + alias
    StagingProcessorAdapter,
    { provide: STAGING_PROCESSOR, useExisting: StagingProcessorAdapter },
    // Data sources (7 IDataSource implementations)
    MercadoLibreAdapter,
    AliExpressAdapter,
    TemuAdapter,
    SheinAdapter,
    ApiRateAdapter,
    CsvAdapter,
    EncuestaAdapter,
    // ARRAY token via useFactory to group them under DATA_SOURCES
    {
      provide: DATA_SOURCES,
      useFactory: (
        meli: MercadoLibreAdapter,
        ali: AliExpressAdapter,
        temu: TemuAdapter,
        shein: SheinAdapter,
        api: ApiRateAdapter,
        csv: CsvAdapter,
        enc: EncuestaAdapter,
      ) => [meli, ali, temu, shein, api, csv, enc],
      inject: [
        MercadoLibreAdapter,
        AliExpressAdapter,
        TemuAdapter,
        SheinAdapter,
        ApiRateAdapter,
        CsvAdapter,
        EncuestaAdapter,
      ],
    },
  ],
  exports: [
    PipelineService,
    DW_LOADER,
    DATA_SOURCES,
    STAGING_PROCESSOR,
    EtlSchedulerService,
    BrowserFactoryService,
  ],
})
export class PipelineModule {}
