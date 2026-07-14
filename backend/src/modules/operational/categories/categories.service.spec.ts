import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
};

type MappingRow = {
  categoryId: string;
  sourceId: string;
  remoteCode: string;
};

type SourceRow = {
  id: string;
  code: string;
  name: string;
};

function buildPrismaStub() {
  const categories = new Map<string, CategoryRow>();
  const sources = new Map<string, SourceRow>();
  const mappings = new Map<string, MappingRow>();
  let nextId = 0;
  const newId = () => `cat_${++nextId}`;

  const txState = {
    categories: new Map<string, CategoryRow>(),
    mappings: new Map<string, MappingRow>(),
  };

  const stub = {
    category: {
      findMany: jest.fn(
        ({
          where,
          orderBy,
        }: {
          where?: { parentId?: string; path?: { startsWith?: string }; id?: { in?: string[] } };
          orderBy?: unknown;
        }) => {
          let results = Array.from(categories.values());

          if (where?.parentId !== undefined) {
            results = results.filter((c) => c.parentId === where.parentId);
          }
          if (where?.path?.startsWith !== undefined) {
            results = results.filter((c) =>
              c.path.startsWith(where.path!.startsWith),
            );
          }
          if (where?.id?.in !== undefined) {
            results = results.filter((c) => where.id!.in!.includes(c.id));
          }

          if (orderBy && typeof orderBy === 'object') {
            const [key, dir] = Object.entries(orderBy)[0] as [string, string];
            results.sort((a, b) => {
              const aVal = a[key as keyof CategoryRow] as string;
              const bVal = b[key as keyof CategoryRow] as string;
              return dir === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
            });
          }

          return results;
        },
      ),
      findUnique: jest.fn(
        ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { children?: boolean };
        }) => {
          const cat = categories.get(where.id);
          if (!cat) return null;
          if (include?.children) {
            const children = Array.from(categories.values()).filter(
              (c) => c.parentId === where.id,
            );
            return { ...cat, children };
          }
          return cat;
        },
      ),
      create: jest.fn(
        ({ data }: { data: { name: string; parentId?: string | null; path?: string } }) => {
          const id = newId();
          const row: CategoryRow = {
            id,
            name: data.name,
            parentId: data.parentId ?? null,
            path: data.path ?? '',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          categories.set(id, row);
          return row;
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<CategoryRow>;
        }) => {
          const existing = categories.get(where.id);
          if (!existing) throw new Error('not found');
          Object.assign(existing, data, { updatedAt: new Date() });
          return existing;
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        const existing = categories.get(where.id);
        if (!existing) throw new Error('not found');
        categories.delete(where.id);
        return existing;
      }),
    },
    categorySourceMapping: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { categoryId_sourceId: { categoryId: string; sourceId: string } };
        }) => {
          const key = `${where.categoryId_sourceId.categoryId}:${where.categoryId_sourceId.sourceId}`;
          return mappings.get(key) ?? null;
        },
      ),
      findMany: jest.fn(
        ({
          where,
          include,
        }: {
          where: { categoryId?: string; sourceId?: string };
          include?: { source?: boolean; category?: boolean };
        }) => {
          let results = Array.from(mappings.values());
          if (where?.categoryId) {
            results = results.filter((m) => m.categoryId === where.categoryId);
          }
          if (where?.sourceId) {
            results = results.filter((m) => m.sourceId === where.sourceId);
          }
          if (include?.source) {
            results = results.map((m) => ({
              ...m,
              source: { id: m.sourceId, code: 'test-source' },
            })) as unknown as MappingRow[];
          }
          if (include?.category) {
            results = results.map((m) => ({
              ...m,
              category: { id: m.categoryId, name: 'test-category' },
            })) as unknown as MappingRow[];
          }
          return results;
        },
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: { categoryId: string; sourceId: string; remoteCode: string };
        }) => {
          const key = `${data.categoryId}:${data.sourceId}`;
          const row: MappingRow = {
            categoryId: data.categoryId,
            sourceId: data.sourceId,
            remoteCode: data.remoteCode,
          };
          mappings.set(key, row);
          return row;
        },
      ),
      delete: jest.fn(
        ({
          where,
        }: {
          where: { categoryId_sourceId: { categoryId: string; sourceId: string } };
        }) => {
          const key = `${where.categoryId_sourceId.categoryId}:${where.categoryId_sourceId.sourceId}`;
          const existing = mappings.get(key);
          if (!existing) throw new Error('not found');
          mappings.delete(key);
          return existing;
        },
      ),
    },
    source: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        return sources.get(where.id) ?? null;
      }),
    },
    $transaction: jest.fn(
      async <T>(
        fn: (tx: typeof stub) => Promise<T>,
      ): Promise<T> => {
        return fn(stub);
      },
    ),
    __state: { categories, sources, mappings },
  };

  return stub;
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: ReturnType<typeof buildPrismaStub>;

  beforeEach(async () => {
    prisma = buildPrismaStub();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: OperationalPrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CategoriesService);
  });

  describe('create', () => {
    it('creates a root category with path = self id', async () => {
      const result = await service.create({ name: 'Electrónicos' });

      expect(result.name).toBe('Electrónicos');
      expect(result.parentId).toBeNull();
      expect(result.path).toBe(result.id);
    });

    it('creates a child category with path = parentId/childId', async () => {
      const parent = await service.create({ name: 'Electrónicos' });
      const child = await service.create({
        name: 'Celulares',
        parentId: parent.id,
      });

      expect(child.path).toBe(`${parent.id}/${child.id}`);
    });

    it('throws NotFoundException when parent does not exist', async () => {
      await expect(
        service.create({ name: 'Celulares', parentId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns a category by id', async () => {
      const created = await service.create({ name: 'Test' });
      const found = await service.findOne(created.id);
      expect(found.id).toBe(created.id);
    });

    it('throws NotFoundException when not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('renames a category', async () => {
      const cat = await service.create({ name: 'Old Name' });
      const updated = await service.update(cat.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('prevents self-referencing parentId', async () => {
      const cat = await service.create({ name: 'Test' });
      await expect(
        service.update(cat.id, { parentId: cat.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents reparent to a descendant', async () => {
      const parent = await service.create({ name: 'Parent' });
      const child = await service.create({
        name: 'Child',
        parentId: parent.id,
      });
      // Try to make the parent a child of its own child
      await expect(
        service.update(parent.id, { parentId: child.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when updating nonexistent category', async () => {
      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a category with no children', async () => {
      const cat = await service.create({ name: 'Orphan' });
      await service.remove(cat.id);
      await expect(service.findOne(cat.id)).rejects.toThrow(NotFoundException);
    });

    it('prevents deleting a category with children', async () => {
      const parent = await service.create({ name: 'Parent' });
      await service.create({ name: 'Child', parentId: parent.id });

      await expect(service.remove(parent.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when deleting nonexistent category', async () => {
      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ancestor queries', () => {
    it('returns empty ancestors for root category', async () => {
      const root = await service.create({ name: 'Root' });
      const ancestors = await service.getAncestors(root.id);
      expect(ancestors).toHaveLength(0);
    });

    it('returns ancestors for a deeply nested category', async () => {
      const l1 = await service.create({ name: 'L1' });
      const l2 = await service.create({ name: 'L2', parentId: l1.id });
      const l3 = await service.create({ name: 'L3', parentId: l2.id });

      const ancestors = await service.getAncestors(l3.id);
      expect(ancestors).toHaveLength(2);
      const ancestorIds = ancestors.map((a) => a.id);
      expect(ancestorIds).toContain(l1.id);
      expect(ancestorIds).toContain(l2.id);
    });
  });

  describe('descendant queries', () => {
    it('returns all descendants', async () => {
      const root = await service.create({ name: 'Root' });
      const child = await service.create({ name: 'Child', parentId: root.id });
      await service.create({ name: 'Grandchild', parentId: child.id });

      const descendants = await service.getDescendants(root.id);
      expect(descendants).toHaveLength(2);
    });

    it('returns empty descendants for leaf category', async () => {
      const root = await service.create({ name: 'Root' });
      const leaf = await service.create({ name: 'Leaf', parentId: root.id });

      const descendants = await service.getDescendants(leaf.id);
      expect(descendants).toHaveLength(0);
    });
  });

  describe('children query', () => {
    it('returns direct children only', async () => {
      const root = await service.create({ name: 'Root' });
      const child1 = await service.create({ name: 'Child1', parentId: root.id });
      const child2 = await service.create({ name: 'Child2', parentId: root.id });
      await service.create({ name: 'Grandchild', parentId: child1.id });

      const children = await service.getChildren(root.id);
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toContain(child1.id);
      expect(children.map((c) => c.id)).toContain(child2.id);
    });
  });

  describe('category-source mappings', () => {
    let catId: string;

    beforeEach(async () => {
      const cat = await service.create({ name: 'Test Category' });
      catId = cat.id;
      // Seed a source in the in-memory store for mapping tests
      prisma.__state.sources.set('src_source1', {
        id: 'src_source1',
        code: 'SOURCE_1',
        name: 'Source 1',
      });
    });

    it('creates a mapping between category and source', async () => {
      const mapping = await service.createMapping(
        catId,
        'src_source1',
        'remote-123',
      );
      expect(mapping.categoryId).toBe(catId);
      expect(mapping.sourceId).toBe('src_source1');
      expect(mapping.remoteCode).toBe('remote-123');
    });

    it('throws ConflictException for duplicate mapping', async () => {
      await service.createMapping(catId, 'src_source1', 'remote-123');
      await expect(
        service.createMapping(catId, 'src_source1', 'remote-456'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when category does not exist for mapping', async () => {
      await expect(
        service.createMapping('nonexistent', 'src_source1', 'x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('removes a mapping', async () => {
      await service.createMapping(catId, 'src_source1', 'remote-123');
      await service.removeMapping(catId, 'src_source1');

      const mappings = await service.listMappingsByCategory(catId);
      expect(mappings).toHaveLength(0);
    });

    it('throws NotFoundException when removing nonexistent mapping', async () => {
      await expect(
        service.removeMapping(catId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lists mappings by category', async () => {
      await service.createMapping(catId, 'src_source1', 'remote-123');
      const mappings = await service.listMappingsByCategory(catId);
      expect(mappings).toHaveLength(1);
    });
  });
});
