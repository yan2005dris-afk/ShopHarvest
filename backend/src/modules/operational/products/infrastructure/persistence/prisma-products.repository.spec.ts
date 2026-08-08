import { PrismaProductsRepository } from './prisma-products.repository';
import type { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';

describe('PrismaProductsRepository', () => {
  let repository: PrismaProductsRepository;
  let prisma: {
    $queryRaw: jest.Mock;
    product: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new PrismaProductsRepository(
      prisma as unknown as OperationalPrismaService,
    );
  });

  describe('findAll', () => {
    it('executes raw ID and total count queries with limit, offset and ordering', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'p_1' }, { id: 'p_2' }]) // idRows
        .mockResolvedValueOnce([{ total: 5 }]); // totals

      prisma.product.findMany.mockResolvedValueOnce([
        {
          id: 'p_1',
          title: 'Product 1',
          description: null,
          imageUrl: null,
          categoryId: null,
          brandId: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          offers: [],
        },
        {
          id: 'p_2',
          title: 'Product 2',
          description: null,
          imageUrl: null,
          categoryId: null,
          brandId: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          offers: [],
        },
      ]);

      const result = await repository.findAll({
        page: 2,
        limit: 2,
        q: undefined,
      });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('p_1');
      expect(result.items[1].id).toBe('p_2');
    });

    it('returns empty array when total is 0 without querying findMany', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 0 }]);

      const result = await repository.findAll({
        page: 1,
        limit: 24,
        q: 'nonexistent',
      });

      expect(result).toEqual({ items: [], total: 0 });
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });
  });
});
