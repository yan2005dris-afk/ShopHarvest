import { Test, TestingModule } from '@nestjs/testing';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { EtlSchedulerService } from './etl-scheduler.service';
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';
import { JwtService } from '@nestjs/jwt';

// ── Mock types ──────────────────────────────────────────────────────
type EtlRunMock = {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

type PrismaMock = { etlRun: EtlRunMock };

// ── Fixtures ────────────────────────────────────────────────────────
const mockRuns = [
  {
    id: 'run-1',
    source: 'all',
    status: 'SUCCESS' as const,
    startedAt: new Date('2026-07-10T10:00:00Z'),
    finishedAt: new Date('2026-07-10T10:05:00Z'),
    rowsScraped: 100,
    rowsPersisted: 95,
    errorSummary: null,
    qualityMetric: null,
  },
  {
    id: 'run-2',
    source: 'all',
    status: 'RUNNING' as const,
    startedAt: new Date('2026-07-11T10:00:00Z'),
    finishedAt: null,
    rowsScraped: 50,
    rowsPersisted: 0,
    errorSummary: null,
    qualityMetric: null,
  },
  {
    id: 'run-3',
    source: 'all',
    status: 'FAILED' as const,
    startedAt: new Date('2026-07-09T10:00:00Z'),
    finishedAt: new Date('2026-07-09T10:03:00Z'),
    rowsScraped: 20,
    rowsPersisted: 0,
    errorSummary: 'quality gate failed',
    qualityMetric: null,
  },
];

describe('PipelineController', () => {
  let controller: PipelineController;
  let prisma: PrismaMock;
  let scheduler: EtlSchedulerService;

  const mockPrisma: PrismaMock = {
    etlRun: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockScheduler = {
    runEtlTick: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
    verify: jest.fn(),
    sign: jest.fn(),
  };

  const mockPipelineService = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [
        { provide: PipelineService, useValue: mockPipelineService },
        {
          provide: EtlSchedulerService,
          useValue: mockScheduler,
        },
        {
          provide: OperationalPrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    controller = module.get<PipelineController>(PipelineController);
    prisma = module.get(OperationalPrismaService);
    scheduler = module.get(EtlSchedulerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /pipeline/etl-runs ─────────────────────────────────────

  describe('GET /pipeline/etl-runs', () => {
    it('returns paginated runs ordered by startedAt DESC', async () => {
      prisma.etlRun.findMany.mockResolvedValueOnce(mockRuns);
      prisma.etlRun.count.mockResolvedValueOnce(3);

      const result = await controller.listEtlRuns({ page: 1, limit: 10 });

      expect(prisma.etlRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startedAt: 'desc' },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
    });

    it('filters by status when provided', async () => {
      prisma.etlRun.findMany.mockResolvedValueOnce([mockRuns[0]]);
      prisma.etlRun.count.mockResolvedValueOnce(1);

      await controller.listEtlRuns({
        page: 1,
        limit: 10,
        status: 'SUCCESS',
      });

      expect(prisma.etlRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
    });

    it('filters by date range when provided', async () => {
      prisma.etlRun.findMany.mockResolvedValueOnce([mockRuns[0]]);
      prisma.etlRun.count.mockResolvedValueOnce(1);

      await controller.listEtlRuns({
        page: 1,
        limit: 10,
        from: '2026-07-10T00:00:00Z',
        to: '2026-07-11T00:00:00Z',
      });

      expect(prisma.etlRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('applies correct pagination offset for page 2', async () => {
      prisma.etlRun.findMany.mockResolvedValueOnce([mockRuns[0]]);
      prisma.etlRun.count.mockResolvedValueOnce(3);

      await controller.listEtlRuns({ page: 2, limit: 5 });

      expect(prisma.etlRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // ── GET /pipeline/etl-runs/:id ─────────────────────────────────

  describe('GET /pipeline/etl-runs/:id', () => {
    it('returns a single run with qualityMetric', async () => {
      prisma.etlRun.findUnique.mockResolvedValueOnce(mockRuns[0]);

      const result = await controller.getEtlRun('run-1');

      expect(prisma.etlRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        include: { qualityMetric: true },
      });
      expect(result.id).toBe('run-1');
      expect(result.status).toBe('SUCCESS');
    });

    it('throws NotFoundException when run does not exist', async () => {
      prisma.etlRun.findUnique.mockResolvedValueOnce(null);

      await expect(controller.getEtlRun('non-existent')).rejects.toThrow(
        'not found',
      );
    });

    it('computes durationMs when finishedAt is set', async () => {
      prisma.etlRun.findUnique.mockResolvedValueOnce(mockRuns[0]);

      const result = await controller.getEtlRun('run-1');

      // 5 minutes = 300000 ms
      expect(result.durationMs).toBe(300000);
    });

    it('returns durationMs null when run is still running', async () => {
      prisma.etlRun.findUnique.mockResolvedValueOnce(mockRuns[1]);

      const result = await controller.getEtlRun('run-2');

      expect(result.durationMs).toBeNull();
    });
  });

  // ── POST /pipeline/etl-runs/trigger ────────────────────────────

  describe('POST /pipeline/etl-runs/trigger', () => {
    it('returns existing runId when a RUNNING run exists without starting a new tick', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(mockRuns[1]);
      mockScheduler.runEtlTick.mockClear();

      const result = await controller.triggerEtlRun();

      expect(prisma.etlRun.findFirst).toHaveBeenCalledWith({
        where: { status: 'RUNNING' },
      });
      expect(scheduler.runEtlTick).not.toHaveBeenCalled();
      expect(result.runId).toBe('run-2');
    });

    it('calls runEtlTick when no RUNNING run exists', async () => {
      // First findFirst (RUNNING check) → null (no running)
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);

      // Subsequent findFirst calls in the polling loop → none (all return null)
      // After all polling attempts, fallback returns latest
      prisma.etlRun.findFirst.mockResolvedValue(mockRuns[0]);

      mockScheduler.runEtlTick.mockResolvedValueOnce(undefined);

      const result = await controller.triggerEtlRun();

      expect(scheduler.runEtlTick).toHaveBeenCalled();
      expect(result.runId).toBe('run-1');
    });
  });

  // ── GET /pipeline/etl-runs/:id/stream (SSE) ───────────────────

  describe('GET /pipeline/etl-runs/:id/stream (SSE)', () => {
    it('throws when run does not exist', async () => {
      prisma.etlRun.findUnique.mockResolvedValueOnce(null);

      const observable = controller.streamEtlRun('non-existent');
      // Should throw NotFoundException via the Observable
      await expect(
        new Promise<void>((resolve, reject) => {
          observable.subscribe({ error: (err) => reject(err) });
        }),
      ).rejects.toThrow('not found');
    });

    it('completes immediately when run is already terminal', (done) => {
      prisma.etlRun.findUnique.mockResolvedValueOnce(mockRuns[0]);

      const observable = controller.streamEtlRun('run-1');
      observable.subscribe({
        next: (event) => {
          const data = event.data as Record<string, unknown>;
          if (data['event'] === 'complete') {
            expect(data['status']).toBe('SUCCESS');
            done();
          }
        },
      });
    });
  });
});
