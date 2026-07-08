import { Test, TestingModule } from '@nestjs/testing';
import { EtlSchedulerService } from './etl-scheduler.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SchedulerRegistry } from '@nestjs/schedule';

// Note: PR 1b removed the bridge import. The actual scraper wiring
// (AliExpressAdapter → STAGING_PROCESSOR → QualityService → DW_LOADER)
// lands across PR 3, PR 4, and PR 6. Until then, runEtlTick creates the
// EtlRun row, throws the documented stub error, and the catch marks
// the run as FAILED. These tests cover that interim behavior.

type EtlRunMock = {
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

describe('EtlSchedulerService', () => {
  let service: EtlSchedulerService;
  let prisma: { etlRun: EtlRunMock };
  let schedulerRegistry: { addCronJob: jest.Mock };

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
    prisma = module.get(PrismaService);
    schedulerRegistry = module.get(SchedulerRegistry);
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
        where: { source: 'aliexpress', status: 'RUNNING' },
      });
      expect(prisma.etlRun.create).not.toHaveBeenCalled();
    });

    it('should mark the run as FAILED with the stub error until PR 3/4/6 land', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);
      prisma.etlRun.create.mockResolvedValueOnce({ id: 'run-id-stub' });

      await service.runEtlTick();

      expect(prisma.etlRun.create).toHaveBeenCalledWith({
        data: { source: 'aliexpress', status: 'RUNNING' },
      });
      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-id-stub' },
        data: {
          status: 'FAILED',
          errorSummary: expect.stringContaining(
            'native scraper not wired yet',
          ) as string,
          finishedAt: expect.any(Date) as Date,
        },
      });
    });
  });
});
