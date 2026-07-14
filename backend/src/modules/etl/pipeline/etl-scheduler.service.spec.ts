import { Test, TestingModule } from '@nestjs/testing';
import { EtlSchedulerService } from './etl-scheduler.service';
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PipelineService } from './pipeline.service';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { PipelineRunSummary } from '@web-scraping/contracts/pipeline';

// PR 6 (etl-staging-dw-native): runEtlTick now fans out to every
// scraper via PipelineService.runAll() (scrape → staging → quality →
// DW load) instead of the PR 1b stub that always threw. EtlRun.source
// is a single free-form string, so 'all' labels the whole-batch tick.

type EtlRunMock = {
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

describe('EtlSchedulerService', () => {
  let service: EtlSchedulerService;
  let prisma: { etlRun: EtlRunMock };
  let schedulerRegistry: { addCronJob: jest.Mock };
  let pipelineService: {
    runAll: jest.Mock;
    runStaging: jest.Mock;
    loadDw: jest.Mock;
  };

  const mockPrismaService: { etlRun: EtlRunMock } = {
    etlRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockSchedulerRegistry: { addCronJob: jest.Mock } = {
    addCronJob: jest.fn(),
  };

  const mockPipelineService: {
    runAll: jest.Mock;
    runStaging: jest.Mock;
    loadDw: jest.Mock;
  } = {
    runAll: jest.fn(),
    runStaging: jest.fn(),
    loadDw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlSchedulerService,
        { provide: OperationalPrismaService, useValue: mockPrismaService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
        { provide: PipelineService, useValue: mockPipelineService },
      ],
    }).compile();

    service = module.get<EtlSchedulerService>(EtlSchedulerService);
    prisma = module.get(OperationalPrismaService);
    schedulerRegistry = module.get(SchedulerRegistry);
    pipelineService = module.get(PipelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('registers the cron job with the registry', () => {
      service.onModuleInit();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1);
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'etl-tick',
        expect.any(Object),
      );
    });
  });

  describe('runEtlTick', () => {
    it('should skip if another run is in-flight', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce({ id: 'existing-run' });

      await service.runEtlTick();

      expect(prisma.etlRun.findFirst).toHaveBeenCalledWith({
        where: { status: 'RUNNING' },
      });
      expect(prisma.etlRun.create).not.toHaveBeenCalled();
      expect(pipelineService.runAll).not.toHaveBeenCalled();
    });

    it('marks the run SUCCESS and records scraped/persisted counts on a completed load', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-1' });

      const summary: PipelineRunSummary = {
        scrapeResults: [
          {
            source: PipelineSource.MERCADOLIBRE,
            totalScraped: 10,
            outputPath: '/tmp/meli.json',
            durationMs: 100,
            errors: [],
          },
          {
            source: PipelineSource.ALIEXPRESS,
            totalScraped: 5,
            outputPath: '/tmp/ali.json',
            durationMs: 100,
            errors: [],
          },
        ],
        stagingResult: {
          totalProductos: 15,
          totalEncuestas: 2,
          durationMs: 50,
        },
        loadResult: {
          productosCargados: 15,
          encuestasCargadas: 2,
          tiempoMs: 80,
          estado: 'completado',
        },
        totalDurationMs: 230,
      };
      pipelineService.runAll.mockResolvedValueOnce(summary);

      await service.runEtlTick();

      expect(prisma.etlRun.create).toHaveBeenCalledWith({
        data: { source: 'all', status: 'RUNNING' },
      });
      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-1' },
        data: {
          status: 'SUCCESS',
          rowsScraped: 15,
          rowsPersisted: 17,
          errorSummary: null,
          finishedAt: expect.any(Date) as Date,
        },
      });
    });

    it('marks the run FAILED when the DW load reports fallido', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-2' });

      const summary: PipelineRunSummary = {
        scrapeResults: [
          {
            source: PipelineSource.MERCADOLIBRE,
            totalScraped: 10,
            outputPath: '/tmp/meli.json',
            durationMs: 100,
            errors: [],
          },
        ],
        loadResult: {
          productosCargados: 0,
          encuestasCargadas: 0,
          tiempoMs: 10,
          estado: 'fallido',
          error: 'quality gate failed: staging-row-count',
        },
        totalDurationMs: 120,
      };
      pipelineService.runAll.mockResolvedValueOnce(summary);

      await service.runEtlTick();

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-2' },
        data: {
          status: 'FAILED',
          rowsScraped: 10,
          rowsPersisted: 0,
          errorSummary: expect.stringContaining(
            'quality gate failed',
          ) as string,
          finishedAt: expect.any(Date) as Date,
        },
      });
    });

    it('marks the run FAILED when PipelineService.runAll() throws', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-3' });
      pipelineService.runAll.mockRejectedValueOnce(
        new Error('unexpected crash'),
      );

      await service.runEtlTick();

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-3' },
        data: {
          status: 'FAILED',
          errorSummary: 'unexpected crash',
          finishedAt: expect.any(Date) as Date,
        },
      });
    });

    it('runs staging and load in-memory for action === local', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-local' });

      const mockProducts = [{ titulo_oferta: 'Local Product' }];
      const mockEncuestas = [{ edad: 22 }];

      pipelineService.runStaging.mockResolvedValueOnce({
        totalProductos: 1,
        totalEncuestas: 1,
        durationMs: 15,
        productos: mockProducts,
        encuestas: mockEncuestas,
      });

      pipelineService.loadDw.mockResolvedValueOnce({
        productosCargados: 1,
        encuestasCargadas: 1,
        tiempoMs: 20,
        estado: 'completado',
      });

      await service.runEtlTick({ action: 'local', source: 'mercadolibre' });

      expect(prisma.etlRun.create).toHaveBeenCalledWith({
        data: { source: 'pending', status: 'RUNNING' },
      });

      expect(pipelineService.runStaging).toHaveBeenCalledWith({
        source: 'mercadolibre',
      });

      expect(pipelineService.loadDw).toHaveBeenCalledWith({
        inMemoryData: {
          productos: mockProducts,
          encuestas: mockEncuestas,
        },
      });

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-local' },
        data: {
          status: 'SUCCESS',
          rowsScraped: 0,
          rowsPersisted: 2,
          errorSummary: null,
          finishedAt: expect.any(Date) as Date,
        },
      });
    });
  });
});
