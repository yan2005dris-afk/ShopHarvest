/**
 * Tests for EtlProductRepository.
 *
 * RED phase: the repository does not exist yet. We mock the Prisma client
 * to verify:
 *   - persistProducts upserts by the @@unique([source, sourceId]) key
 *   - persistProducts wraps all upserts in a single $transaction
 *   - the transaction rolls back when any upsert throws
 *   - createQualityMetric writes a single QualityMetric row
 */
import { EtlProductRepository, QualityCheck } from './etl-product.repository';

type FakeTx = {
  etlProduct: { upsert: jest.Mock };
  qualityMetric: { create: jest.Mock };
};

type FakePrisma = {
  $transaction: jest.Mock;
  etlProduct: { upsert: jest.Mock };
  qualityMetric: { create: jest.Mock };
};

function buildPrisma(): { prisma: FakePrisma; tx: FakeTx } {
  const tx: FakeTx = {
    etlProduct: { upsert: jest.fn() },
    qualityMetric: { create: jest.fn() },
  };
  const prisma: FakePrisma = {
    etlProduct: { upsert: jest.fn() },
    qualityMetric: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Default: $transaction invokes the callback with the tx mock.
  prisma.$transaction.mockImplementation((cb: (tx: FakeTx) => Promise<unknown>) => cb(tx));
  return { prisma, tx };
}

const sampleProducts = [
  { sourceId: 'mystery:sharp-objects', title: 'Sharp Objects', price: 47.82, currency: 'GBP' },
  { sourceId: 'fiction:the-stand', title: 'The Stand', price: 36.2, currency: 'GBP' },
];

describe('EtlProductRepository', () => {
  let prisma: FakePrisma;
  let tx: FakeTx;
  let repo: EtlProductRepository;

  beforeEach(() => {
    ({ prisma, tx } = buildPrisma());
    repo = new EtlProductRepository(prisma as never);
  });

  describe('persistProducts', () => {
    it('upserts each product by the (source, sourceId) composite key', async () => {
      tx.etlProduct.upsert.mockResolvedValue({});

      await repo.persistProducts('run-1', sampleProducts);

      expect(tx.etlProduct.upsert).toHaveBeenCalledTimes(sampleProducts.length);
      expect(tx.etlProduct.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { source_sourceId: { source: 'aliexpress', sourceId: 'mystery:sharp-objects' } },
        }),
      );
    });

    it('returns the number of products persisted', async () => {
      tx.etlProduct.upsert.mockResolvedValue({});

      const count = await repo.persistProducts('run-1', sampleProducts);

      expect(count).toBe(sampleProducts.length);
    });

    it('wraps all upserts in a single $transaction', async () => {
      tx.etlProduct.upsert.mockResolvedValue({});

      await repo.persistProducts('run-1', sampleProducts);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rolls back the transaction when any upsert throws', async () => {
      tx.etlProduct.upsert
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('unique violation'));

      await expect(repo.persistProducts('run-1', sampleProducts)).rejects.toThrow(
        /unique violation/,
      );

      // Even though the second upsert threw, $transaction was still called
      // once — Prisma handles the rollback.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('createQualityMetric', () => {
    it('writes a single QualityMetric row scoped to the run', async () => {
      prisma.qualityMetric.create.mockResolvedValue({});
      const check: QualityCheck = {
        completenessPct: 98.3,
        duplicatesRemoved: 0,
        checks: { titlesNonEmpty: { passed: 60, failed: 0 } },
      };

      await repo.createQualityMetric('run-1', check);

      expect(prisma.qualityMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          etlRunId: 'run-1',
          completenessPct: 98.3,
          duplicatesRemoved: 0,
        }),
      });
    });
  });
});