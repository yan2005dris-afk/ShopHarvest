import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RawCapturesService } from './raw-captures.service';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';

type RawCaptureRow = {
  offerId: string;
  sourceId: string;
  payload: unknown;
  capturedAt: Date;
  source?: { id: string; name: string };
};

function buildPrismaStub() {
  const captures = new Map<string, RawCaptureRow>();

  const key = (offerId: string, sourceId: string) => `${offerId}::${sourceId}`;

  return {
    source: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        // Simulate: source exists if its id starts with 'src_'
        if (where.id.startsWith('src_')) {
          return { id: where.id, name: 'Test Source' };
        }
        return null;
      }),
    },
    rawCapture: {
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { offerId_sourceId: { offerId: string; sourceId: string } };
          create: { offerId: string; sourceId: string; payload: unknown };
          update: { payload: unknown; capturedAt: Date };
        }) => {
          const k = key(create.offerId, create.sourceId);
          const existing = captures.get(k);
          const now = new Date();

          if (existing) {
            // Update
            existing.payload = update.payload;
            existing.capturedAt = update.capturedAt;
            return existing;
          }

          // Create
          const row: RawCaptureRow = {
            offerId: create.offerId,
            sourceId: create.sourceId,
            payload: create.payload,
            capturedAt: now,
          };
          captures.set(k, row);
          return row;
        },
      ),
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            offerId_sourceId?: { offerId: string; sourceId: string };
          };
          include?: { source: boolean };
        }) => {
          const k = key(
            where.offerId_sourceId.offerId,
            where.offerId_sourceId.sourceId,
          );
          const existing = captures.get(k);
          if (!existing) return null;
          return { ...existing, source: { id: existing.sourceId, name: 'Test' } };
        },
      ),
      findMany: jest.fn(
        ({
          where,
        }: {
          where?: { sourceId?: string };
          orderBy?: unknown;
          include?: { source: boolean };
        }) => {
          let results = Array.from(captures.values());
          if (where?.sourceId) {
            results = results.filter((r) => r.sourceId === where.sourceId);
          }
          results.sort(
            (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
          );
          return results.map((r) => ({
            ...r,
            source: { id: r.sourceId, name: 'Test' },
          }));
        },
      ),
      delete: jest.fn(
        ({
          where,
        }: {
          where: {
            offerId_sourceId: { offerId: string; sourceId: string };
          };
        }) => {
          const k = key(
            where.offerId_sourceId.offerId,
            where.offerId_sourceId.sourceId,
          );
          const existing = captures.get(k);
          if (!existing) throw new Error('not found');
          captures.delete(k);
          return existing;
        },
      ),
    },
    __state: { captures },
  };
}

describe('RawCapturesService', () => {
  let service: RawCapturesService;
  let prisma: ReturnType<typeof buildPrismaStub>;

  beforeEach(async () => {
    prisma = buildPrismaStub();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RawCapturesService,
        { provide: OperationalPrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(RawCapturesService);
  });

  describe('upsert', () => {
    it('creates a new raw capture', async () => {
      const result = await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: { price: 100, title: 'Test' },
      });

      expect(result.offerId).toBe('off_001');
      expect(result.sourceId).toBe('src_001');
      expect(result.payload).toEqual({ price: 100, title: 'Test' });
    });

    it('overwrites existing capture on re-scrape (same offerId + sourceId)', async () => {
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: { price: 100 },
      });

      const updated = await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: { price: 90, title: 'Updated' },
      });

      expect(updated.payload).toEqual({ price: 90, title: 'Updated' });
    });

    it('keeps captures independent for different sourceIds', async () => {
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: { source: 'ML' },
      });
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_002',
        payload: { source: 'AMZ' },
      });

      const all = await service.findAll();
      expect(all).toHaveLength(2);
    });

    it('throws NotFoundException when source does not exist', async () => {
      await expect(
        service.upsert({
          offerId: 'off_001',
          sourceId: 'nonexistent',
          payload: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts empty object payload', async () => {
      const result = await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: {},
      });

      expect(result.payload).toEqual({});
    });
  });

  describe('findOne', () => {
    it('finds a capture by composite key', async () => {
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: { price: 100 },
      });

      const found = await service.findOne('off_001', 'src_001');
      expect(found.offerId).toBe('off_001');
      expect(found.sourceId).toBe('src_001');
    });

    it('throws NotFoundException when capture not found', async () => {
      await expect(
        service.findOne('nonexistent', 'src_001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns all captures', async () => {
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: {},
      });
      await service.upsert({
        offerId: 'off_002',
        sourceId: 'src_001',
        payload: {},
      });

      const results = await service.findAll();
      expect(results).toHaveLength(2);
    });

    it('filters by sourceId', async () => {
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: {},
      });
      await service.upsert({
        offerId: 'off_002',
        sourceId: 'src_002',
        payload: {},
      });

      const results = await service.findAll('src_001');
      expect(results).toHaveLength(1);
      expect(results[0].sourceId).toBe('src_001');
    });
  });

  describe('remove', () => {
    it('deletes an existing capture', async () => {
      await service.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: {},
      });

      await service.remove('off_001', 'src_001');
      const key = 'off_001::src_001';
      expect(prisma.__state.captures.has(key)).toBe(false);
    });

    it('throws NotFoundException when deleting nonexistent capture', async () => {
      await expect(
        service.remove('nonexistent', 'src_001'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
