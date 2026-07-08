import { Test, TestingModule } from '@nestjs/testing';
import { EtlSchedulerService } from './etl-scheduler.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as fs from 'fs';
import { runAliExpressScrape } from './pipeline-scripts-bridge';

// Mock the fs module at module level to avoid non-configurable property errors with spyOn
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock the bridge method
jest.mock('./pipeline-scripts-bridge', () => ({
  runAliExpressScrape: jest.fn(),
}));

const mockRunAliExpressScrape = runAliExpressScrape as jest.MockedFunction<typeof runAliExpressScrape>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe('EtlSchedulerService', () => {
  let service: EtlSchedulerService;
  let prisma: any;
  let schedulerRegistry: SchedulerRegistry;

  const mockPrismaService = {
    etlRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    etlProduct: {
      upsert: jest.fn(),
    },
    qualityMetric: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockSchedulerRegistry = {
    addCronJob: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlSchedulerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get<EtlSchedulerService>(EtlSchedulerService);
    prisma = module.get<PrismaService>(PrismaService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('registers the cron job with the registry', () => {
      service.onModuleInit();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1);
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith('etl-tick', expect.any(Object));
    });
  });

  describe('runEtlTick', () => {
    it('should skip if another run is in-flight', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce({ id: 'existing-run' });

      await service.runEtlTick();

      expect(prisma.etlRun.findFirst).toHaveBeenCalledWith({
        where: { source: 'aliexpress', status: 'RUNNING' },
      });
      expect(prisma.etlRun.create).not.toHaveBeenCalled();
    });

    it('should complete successfully and persist products', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-123' });
      mockRunAliExpressScrape.mockResolvedValueOnce({
        source: 'aliexpress' as any,
        totalScraped: 2,
        outputPath: 'dummy-path.json',
        durationMs: 1500,
        errors: [],
      });

      mockExistsSync.mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValueOnce(
        JSON.stringify([
          {
            titulo: 'Book One',
            precio: '£10.50',
            moneda: 'GBP',
            rating: 'Three',
            disponibilidad: 'In Stock',
            categoria: 'mystery',
          },
          {
            titulo: 'Book Two',
            precio: '£25.00',
            moneda: 'GBP',
            rating: 'Four',
            disponibilidad: 'In Stock',
            categoria: 'fiction',
          },
        ]),
      );

      await service.runEtlTick();

      expect(prisma.etlRun.create).toHaveBeenCalledWith({
        data: { source: 'aliexpress', status: 'RUNNING' },
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(prisma.qualityMetric.create).toHaveBeenCalledWith({
        data: {
          etlRunId: 'run-id-123',
          completenessPct: 100,
          duplicatesRemoved: 0,
          checks: {},
        },
      });

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-123' },
        data: {
          status: 'SUCCESS',
          rowsScraped: 2,
          rowsPersisted: 2,
          finishedAt: expect.any(Date),
        },
      });
    });

    it('should handle scraper failure and mark run as FAILED', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-fail' });
      mockRunAliExpressScrape.mockRejectedValueOnce(new Error('Playwright launch crash'));

      await service.runEtlTick();

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-fail' },
        data: {
          status: 'FAILED',
          errorSummary: 'Playwright launch crash',
          finishedAt: expect.any(Date),
        },
      });
    });
  });
});
