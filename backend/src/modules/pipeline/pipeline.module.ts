import { Module } from '@nestjs/common';
import {
  DW_LOADER,
  DATA_SOURCES,
  STAGING_PROCESSOR,
} from '@web-scraping/contracts/pipeline';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { DwLoaderAdapter } from './adapters/dw-loader.adapter';
import { StagingProcessorAdapter } from './adapters/staging-processor.adapter';
import { EtlSchedulerService } from './etl-scheduler.service';
import { BrowserFactoryService } from './scraping/browser-factory.service';
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
  controllers: [PipelineController],
  providers: [
    PipelineService,
    EtlSchedulerService,
    // BrowserFactoryService — singleton, stealth always-on, proxy opt-in
    // Consumed by Playwright-based scrapers (MELI/AliExpress in PR 3/4).
    // Extension-based scrapers (Temu/Shein in PR 5) MUST NOT inject it.
    BrowserFactoryService,
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
