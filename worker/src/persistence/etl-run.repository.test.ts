/**
 * Tests for EtlRunRepository.
 *
 * RED phase: the repository does not exist yet. We mock the Prisma client
 * so each method can be tested in isolation against a deterministic stub.
 */
import { EtlRunRepository } from './etl-run.repository';

type FakePrisma = {
  etlRun: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
};

function buildPrisma(): FakePrisma {
  return {
    etlRun: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
}

describe('EtlRunRepository', () => {
  let repo: EtlRunRepository;
  let prisma: FakePrisma;

  beforeEach(() => {
    prisma = buildPrisma();
    repo = new EtlRunRepository(prisma as never);
  });

  describe('createRun', () => {
    it('inserts a new RUNNING run for the given source', async () => {
      const fakeRun = { id: 'run-1', source: 'aliexpress', status: 'RUNNING' };
      prisma.etlRun.create.mockResolvedValueOnce(fakeRun);

      const run = await repo.createRun('aliexpress');

      expect(run).toEqual(fakeRun);
      expect(prisma.etlRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: 'aliexpress', status: 'RUNNING' }),
        }),
      );
    });
  });

  describe('completeRun', () => {
    it('marks the run SUCCESS with scraped and persisted counts', async () => {
      prisma.etlRun.update.mockResolvedValueOnce({});

      await repo.completeRun('run-1', 60, 60);

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          rowsScraped: 60,
          rowsPersisted: 60,
          finishedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('failRun', () => {
    it('marks the run FAILED with error message', async () => {
      prisma.etlRun.update.mockResolvedValueOnce({});

      await repo.failRun('run-1', new Error('Playwright launch failed'));

      expect(prisma.etlRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorSummary: 'Playwright launch failed',
          finishedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('getInFlightRun', () => {
    it('returns the RUNNING run for the source when one exists', async () => {
      const fakeRun = { id: 'run-1', source: 'aliexpress', status: 'RUNNING' };
      prisma.etlRun.findFirst.mockResolvedValueOnce(fakeRun);

      const result = await repo.getInFlightRun('aliexpress');

      expect(result).toEqual(fakeRun);
      expect(prisma.etlRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { source: 'aliexpress', status: 'RUNNING' } }),
      );
    });

    it('returns null when no RUNNING run exists for the source', async () => {
      prisma.etlRun.findFirst.mockResolvedValueOnce(null);

      const result = await repo.getInFlightRun('aliexpress');

      expect(result).toBeNull();
    });
  });
});