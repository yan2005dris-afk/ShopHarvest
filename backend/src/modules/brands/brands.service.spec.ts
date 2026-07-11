import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';

type BrandRow = {
  id: string;
  name: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
};

function buildPrismaStub() {
  const brands = new Map<string, BrandRow>();
  let nextId = 0;
  const newId = () => `brd_${++nextId}`;

  return {
    brand: {
      findMany: jest.fn(({ orderBy }: { orderBy?: unknown }) => {
        const all = Array.from(brands.values());
        if (orderBy && (orderBy as Record<string, string>).name === 'asc') {
          all.sort((a, b) => a.name.localeCompare(b.name));
        }
        return all;
      }),
      findUnique: jest.fn(
        ({ where }: { where: { id?: string; name?: string } }) => {
          if (where.id) return brands.get(where.id) ?? null;
          if (where.name) {
            return (
              Array.from(brands.values()).find((b) => b.name === where.name) ??
              null
            );
          }
          return null;
        },
      ),
      create: jest.fn(
        ({ data }: { data: { name: string; aliases: string[] } }) => {
          const row: BrandRow = {
            id: newId(),
            name: data.name,
            aliases: data.aliases,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          brands.set(row.id, row);
          return row;
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<BrandRow>;
        }) => {
          const existing = brands.get(where.id);
          if (!existing) throw new Error('not found');
          Object.assign(existing, data, { updatedAt: new Date() });
          return existing;
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        const existing = brands.get(where.id);
        if (!existing) throw new Error('not found');
        brands.delete(where.id);
        return existing;
      }),
    },
    $queryRaw: jest.fn(),
    __state: { brands },
  };
}

describe('BrandsService', () => {
  let service: BrandsService;
  let prisma: ReturnType<typeof buildPrismaStub>;

  beforeEach(async () => {
    prisma = buildPrismaStub();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        { provide: OperationalPrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(BrandsService);
  });

  describe('create', () => {
    it('creates a brand with name and aliases', async () => {
      const result = await service.create({
        name: 'Nike',
        aliases: ['NIKE', 'Nike Inc.'],
      });

      expect(result.name).toBe('Nike');
      expect(result.aliases).toEqual(['NIKE', 'Nike Inc.']);
    });

    it('rejects duplicate brand name', async () => {
      await service.create({ name: 'Nike', aliases: [] });

      await expect(
        service.create({ name: 'Nike', aliases: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a brand without aliases', async () => {
      const result = await service.create({
        name: 'Samsung',
        aliases: [],
      });

      expect(result.name).toBe('Samsung');
      expect(result.aliases).toEqual([]);
    });
  });

  describe('findAll / findOne', () => {
    it('returns all brands sorted by name', async () => {
      await service.create({ name: 'Zara', aliases: [] });
      await service.create({ name: 'Apple', aliases: [] });

      const results = await service.findAll();
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Apple');
      expect(results[1].name).toBe('Zara');
    });

    it('finds a brand by id', async () => {
      const created = await service.create({ name: 'Sony', aliases: [] });
      const found = await service.findOne(created.id);
      expect(found.id).toBe(created.id);
    });

    it('throws NotFoundException when brand not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates brand name', async () => {
      const created = await service.create({
        name: 'Nike',
        aliases: ['NIKE'],
      });

      const updated = await service.update(created.id, { name: 'Nike Updated' });
      expect(updated.name).toBe('Nike Updated');
    });

    it('rejects duplicate name on rename', async () => {
      await service.create({ name: 'Nike', aliases: [] });
      const adidas = await service.create({ name: 'Adidas', aliases: [] });

      await expect(
        service.update(adidas.id, { name: 'Nike' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates aliases', async () => {
      const created = await service.create({
        name: 'Nike',
        aliases: ['NIKE'],
      });

      const updated = await service.update(created.id, {
        aliases: ['NIKE', 'Nike Inc.', 'NK'],
      });
      expect(updated.aliases).toEqual(['NIKE', 'Nike Inc.', 'NK']);
    });
  });

  describe('remove', () => {
    it('deletes an existing brand', async () => {
      const created = await service.create({ name: 'Nike', aliases: [] });
      await service.remove(created.id);
      expect(prisma.__state.brands.has(created.id)).toBe(false);
    });

    it('throws NotFoundException when deleting nonexistent brand', async () => {
      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('fuzzyMatch', () => {
    it('returns empty array for empty query', async () => {
      const result = await service.fuzzyMatch('');
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace-only query', async () => {
      const result = await service.fuzzyMatch('   ');
      expect(result).toEqual([]);
    });
  });
});
