import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SourcesService } from './sources.service';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';

type SourceRow = {
  id: string;
  code: string;
  name: string;
  baseUrl: string;
  status: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function buildPrismaStub() {
  const sources = new Map<string, SourceRow>();
  let nextId = 0;
  const newId = () => `src_${++nextId}`;

  return {
    source: {
      findMany: jest.fn(({ orderBy }: { orderBy?: unknown }) => {
        return Array.from(sources.values()).sort((a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime(),
        );
      }),
      findUnique: jest.fn(
        ({ where }: { where: { id?: string; code?: string } }) => {
          if (where.id) return sources.get(where.id) ?? null;
          if (where.code) {
            return (
              Array.from(sources.values()).find((s) => s.code === where.code) ??
              null
            );
          }
          return null;
        },
      ),
      create: jest.fn(
        ({ data }: { data: { code: string; name: string; baseUrl: string; config?: unknown } }) => {
          const row: SourceRow = {
            id: newId(),
            code: data.code,
            name: data.name,
            baseUrl: data.baseUrl,
            status: 'inactive',
            config: data.config ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          sources.set(row.id, row);
          return row;
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<SourceRow>;
        }) => {
          const existing = sources.get(where.id);
          if (!existing) throw new Error('not found');
          Object.assign(existing, data, { updatedAt: new Date() });
          return existing;
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        const existing = sources.get(where.id);
        if (!existing) throw new Error('not found');
        sources.delete(where.id);
        return existing;
      }),
    },
    __state: { sources },
  };
}

describe('SourcesService', () => {
  let service: SourcesService;
  let prisma: ReturnType<typeof buildPrismaStub>;

  beforeEach(async () => {
    prisma = buildPrismaStub();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: OperationalPrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SourcesService);
  });

  describe('create', () => {
    it('creates a source with status inactive by default', async () => {
      const result = await service.create({
        code: 'ML_AR',
        name: 'Mercado Libre Argentina',
        baseUrl: 'https://www.mercadolibre.com.ar',
      });

      expect(result.code).toBe('ML_AR');
      expect(result.status).toBe('inactive');
    });

    it('rejects duplicate source code', async () => {
      await service.create({
        code: 'ML_AR',
        name: 'Mercado Libre Argentina',
        baseUrl: 'https://www.mercadolibre.com.ar',
      });

      await expect(
        service.create({
          code: 'ML_AR',
          name: 'Mercado Libre Argentina',
          baseUrl: 'https://www.mercadolibre.com.ar',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll / findOne', () => {
    it('returns all sources', async () => {
      await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });
      await service.create({
        code: 'AMZ',
        name: 'Amazon',
        baseUrl: 'https://amazon.com',
      });

      const results = await service.findAll();
      expect(results).toHaveLength(2);
    });

    it('finds a source by id', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });

      const found = await service.findOne(created.id);
      expect(found.id).toBe(created.id);
    });

    it('throws NotFoundException when source not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates source name and baseUrl', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'Mercado Libre',
        baseUrl: 'https://www.mercadolibre.com.ar',
      });

      const updated = await service.update(created.id, {
        name: 'ML Argentina',
        baseUrl: 'https://listado.mercadolibre.com.ar',
      });

      expect(updated.name).toBe('ML Argentina');
      expect(updated.baseUrl).toBe('https://listado.mercadolibre.com.ar');
    });

    it('allows valid status transition inactive→active', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });

      const updated = await service.update(created.id, {
        status: 'active',
      });

      expect(updated.status).toBe('active');
    });

    it('allows valid status transition active→error', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });
      await service.update(created.id, { status: 'active' });

      const updated = await service.update(created.id, { status: 'error' });
      expect(updated.status).toBe('error');
    });

    it('allows valid status transition error→inactive', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });
      await service.update(created.id, { status: 'active' });
      await service.update(created.id, { status: 'error' });

      const updated = await service.update(created.id, { status: 'inactive' });
      expect(updated.status).toBe('inactive');
    });

    it('rejects invalid status transition inactive→error', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });

      await expect(
        service.update(created.id, { status: 'error' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid status transition active→inactive', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });
      await service.update(created.id, { status: 'active' });

      await expect(
        service.update(created.id, { status: 'inactive' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when updating nonexistent source', async () => {
      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes an existing source', async () => {
      const created = await service.create({
        code: 'ML_AR',
        name: 'ML',
        baseUrl: 'https://ml.com.ar',
      });

      await service.remove(created.id);
      expect(prisma.__state.sources.has(created.id)).toBe(false);
    });

    it('throws NotFoundException when deleting nonexistent source', async () => {
      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
