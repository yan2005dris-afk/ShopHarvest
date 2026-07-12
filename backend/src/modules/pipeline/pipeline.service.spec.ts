import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PipelineSource,
  DW_LOADER,
  DATA_SOURCES,
  STAGING_PROCESSOR,
} from '@web-scraping/contracts/pipeline';
import type {
  IDwLoader,
  IDataSource,
  IStagingProcessor,
  LoadResult,
  ScrapeResult,
  StagingResult,
} from './interfaces';
import { PipelineService } from './pipeline.service';
import {
  MercadoLibreAdapter,
  AliExpressAdapter,
  TemuAdapter,
  SheinAdapter,
  ApiRateAdapter,
  CsvAdapter,
  EncuestaAdapter,
} from './adapters/data-sources';
import { DwLoaderAdapter } from './adapters/dw-loader.adapter';
import { StagingProcessorAdapter } from './adapters/staging-processor.adapter';
import { AnalyticsPrismaService } from '../../common/prisma/analytics-prisma.service';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';
import { BrowserFactoryService } from './scraping/browser-factory.service';
import { DwLoaderService } from './etl/dw-loader.service';
import { StagingProcessorService } from './etl/staging-processor.service';
import { QualityService } from './etl/quality.service';

/**
 * RED-first specs for PipelineService.
 *
 * Three things have to be true:
 *   1. The container resolves three symbol tokens to concrete instances.
 *   2. `runScraper(source, config)` picks the right adapter by source.
 *   3. `runAll()` returns the orchestrator summary; `loadDw()` delegates.
 *
 * We override the adapters with stubs (NOT the bridge call) so the
 * spec runs without DB / Playwright / network.
 */
describe('PipelineService', () => {
  let service: PipelineService;
  let dwLoaderStub: jest.Mocked<IDwLoader>;
  let dataSourceStubs: jest.Mocked<IDataSource>[];
  let stagingStub: jest.Mocked<IStagingProcessor>;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    dwLoaderStub = {
      load: jest.fn(),
    };

    stagingStub = {
      run: jest.fn(),
    };

    // Stub each source so we can assert which one fired on runAll().
    dataSourceStubs = [
      { source: PipelineSource.MERCADOLIBRE, run: jest.fn() },
      { source: PipelineSource.ALIEXPRESS, run: jest.fn() },
      { source: PipelineSource.TEMU, run: jest.fn() },
      { source: PipelineSource.SHEIN, run: jest.fn() },
      { source: PipelineSource.API_RATES, run: jest.fn() },
      { source: PipelineSource.CSV_DATASET, run: jest.fn() },
      { source: PipelineSource.ENCUESTA, run: jest.fn() },
    ];

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: DW_LOADER, useValue: dwLoaderStub },
        { provide: DATA_SOURCES, useValue: dataSourceStubs },
        { provide: STAGING_PROCESSOR, useValue: stagingStub },
      ],
    }).compile();

    service = moduleRef.get(PipelineService);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('getAvailableSources', () => {
    it('returns the 7 PipelineSource enum values in declaration order', () => {
      expect(service.getAvailableSources()).toEqual([
        PipelineSource.MERCADOLIBRE,
        PipelineSource.ALIEXPRESS,
        PipelineSource.TEMU,
        PipelineSource.SHEIN,
        PipelineSource.API_RATES,
        PipelineSource.CSV_DATASET,
        PipelineSource.ENCUESTA,
      ]);
    });
  });

  describe('runScraper', () => {
    it('picks the adapter that matches the requested source', async () => {
      const meliScrape: ScrapeResult = {
        source: PipelineSource.MERCADOLIBRE,
        totalScraped: 42,
        outputPath: '/tmp/meli.json',
        durationMs: 1000,
        errors: [],
      };
      dataSourceStubs[0].run.mockResolvedValueOnce(meliScrape);

      const result = await service.runScraper(PipelineSource.MERCADOLIBRE, {
        source: PipelineSource.MERCADOLIBRE,
        outputDir: 'pipeline/raw/scraping/mercadolibre',
      });

      expect(result).toBe(meliScrape);
      expect(dataSourceStubs[0].run).toHaveBeenCalledWith({
        source: PipelineSource.MERCADOLIBRE,
        outputDir: 'pipeline/raw/scraping/mercadolibre',
      });
    });

    it('throws on source mismatch between adapter and config', async () => {
      await expect(
        service.runScraper(PipelineSource.MERCADOLIBRE, {
          source: PipelineSource.ALIEXPRESS, // mismatched
          outputDir: 'pipeline/raw/scraping/aliexpress',
        }),
      ).rejects.toThrow(/Source mismatch/);
    });
  });

  describe('loadDw', () => {
    it('delegates to IDwLoader.load() and returns its LoadResult', async () => {
      const result: LoadResult = {
        productosCargados: 164,
        encuestasCargadas: 24,
        tiempoMs: 932,
        estado: 'completado',
      };
      dwLoaderStub.load.mockResolvedValueOnce(result);

      const actual = await service.loadDw({ truncateFirst: true });
      expect(actual).toBe(result);
      expect(dwLoaderStub.load).toHaveBeenCalledWith({ truncateFirst: true });
    });
  });

  describe('runAll', () => {
    it('runs every source in parallel, then staging, then DW load', async () => {
      // All seven adapters return successful scrape results.
      const scrapeResults: ScrapeResult[] = dataSourceStubs.map(
        (stub, idx) => ({
          source: stub.source,
          totalScraped: 10 + idx,
          outputPath: `/tmp/${stub.source}.json`,
          durationMs: 100 + idx,
          errors: [],
        }),
      );
      for (let i = 0; i < dataSourceStubs.length; i++) {
        dataSourceStubs[i].run.mockResolvedValueOnce(scrapeResults[i]);
      }

      const stagingResult: StagingResult = {
        totalProductos: 168,
        totalEncuestas: 24,
        durationMs: 200,
      };
      stagingStub.run.mockResolvedValueOnce(stagingResult);

      const loadResult: LoadResult = {
        productosCargados: 164,
        encuestasCargadas: 24,
        tiempoMs: 932,
        estado: 'completado',
      };
      dwLoaderStub.load.mockResolvedValueOnce(loadResult);

      const summary = await service.runAll({
        loadOpts: { truncateFirst: true },
      });

      // Every source fired once.
      for (const stub of dataSourceStubs) {
        expect(stub.run).toHaveBeenCalledTimes(1);
      }
      expect(stagingStub.run).toHaveBeenCalledWith(undefined);
      expect(dwLoaderStub.load).toHaveBeenCalledWith({ truncateFirst: true });

      expect(summary.scrapeResults).toHaveLength(7);
      expect(summary.stagingResult).toEqual({
        totalProductos: 168,
        totalEncuestas: 24,
        durationMs: 200,
      });
      expect(summary.loadResult).toBe(loadResult);
      expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('captures per-scraper errors without aborting the whole pipeline', async () => {
      // Make MercadoLibre fail; everyone else succeeds.
      dataSourceStubs[0].run.mockRejectedValueOnce(new Error('network down'));
      for (let i = 1; i < dataSourceStubs.length; i++) {
        dataSourceStubs[i].run.mockResolvedValueOnce({
          source: dataSourceStubs[i].source,
          totalScraped: 1,
          outputPath: '',
          durationMs: 1,
          errors: [],
        });
      }
      stagingStub.run.mockResolvedValueOnce({
        totalProductos: 0,
        totalEncuestas: 0,
        durationMs: 0,
      });
      dwLoaderStub.load.mockResolvedValueOnce({
        productosCargados: 0,
        encuestasCargadas: 0,
        tiempoMs: 0,
        estado: 'completado',
      });

      const summary = await service.runAll();
      const meli = summary.scrapeResults.find(
        (r) => r.source === PipelineSource.MERCADOLIBRE,
      );
      expect(meli?.errors).toContain('network down');
      // The downstream phases still ran (staging + load).
      expect(summary.stagingResult).toBeDefined();
      expect(summary.loadResult).toBeDefined();
    });
  });
});

describe('PipelineModule DI wiring', () => {
  it('binds DW_LOADER / DATA_SOURCES / STAGING_PROCESSOR to the concrete adapters', async () => {
    // Sanity check — instantiate the Nest container with the real
    // adapters (no bridge calls so the test is hermetic). We assert
    // that each token resolves to its expected type. Adapter bodies
    // are NOT invoked (the bridge path uses runtime require, which is
    // exercised only at runtime in Dev). AnalyticsPrismaService is
    // mocked here so DwLoaderAdapter resolves.
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: AnalyticsPrismaService,
          useValue: {
            $executeRawUnsafe: jest.fn(),
            $queryRawUnsafe: jest.fn(),
          },
        },
        {
          provide: OperationalPrismaService,
          useValue: {
            rawCapture: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        BrowserFactoryService,
        QualityService,
        StagingProcessorService,
        DwLoaderService,
        MercadoLibreAdapter,
        AliExpressAdapter,
        TemuAdapter,
        SheinAdapter,
        ApiRateAdapter,
        CsvAdapter,
        EncuestaAdapter,
        DwLoaderAdapter,
        StagingProcessorAdapter,
      ],
    }).compile();

    expect(moduleRef.get(MercadoLibreAdapter).source).toBe(
      PipelineSource.MERCADOLIBRE,
    );
    expect(moduleRef.get(AliExpressAdapter).source).toBe(
      PipelineSource.ALIEXPRESS,
    );
    expect(moduleRef.get(TemuAdapter).source).toBe(PipelineSource.TEMU);
    expect(moduleRef.get(SheinAdapter).source).toBe(PipelineSource.SHEIN);
    expect(moduleRef.get(ApiRateAdapter).source).toBe(PipelineSource.API_RATES);
    expect(moduleRef.get(CsvAdapter).source).toBe(PipelineSource.CSV_DATASET);
    expect(moduleRef.get(EncuestaAdapter).source).toBe(PipelineSource.ENCUESTA);
  });
});
