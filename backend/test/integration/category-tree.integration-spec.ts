import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { OperationalPrismaService } from '../../src/common/prisma/operational-prisma.service';
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  ListCategoryAncestorsUseCase,
  ListCategoryChildrenUseCase,
  ListCategoryDescendantsUseCase,
  UpdateCategoryUseCase,
} from '../../src/modules/operational/categories';

/**
 * Cambio SDD: products-hexagonal. CategoriesService was retired when the
 * categories module was migrated to hexagonal; this integration test was
 * updated to exercise the new public API (CreateCategoryUseCase +
 * tree-list use cases) and to use OperationalPrismaService directly for
 * seed/cleanup (mirroring brands-fuzzy and raw-capture-upsert specs).
 */
describe('Category Tree (integration)', () => {
  let app: INestApplication;
  let createCategory: CreateCategoryUseCase;
  let updateCategory: UpdateCategoryUseCase;
  let ancestorsUseCase: ListCategoryAncestorsUseCase;
  let descendantsUseCase: ListCategoryDescendantsUseCase;
  let childrenUseCase: ListCategoryChildrenUseCase;
  let deleteCategory: DeleteCategoryUseCase;
  let prisma: OperationalPrismaService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    createCategory = moduleFixture.get(CreateCategoryUseCase);
    updateCategory = moduleFixture.get(UpdateCategoryUseCase);
    ancestorsUseCase = moduleFixture.get(ListCategoryAncestorsUseCase);
    descendantsUseCase = moduleFixture.get(ListCategoryDescendantsUseCase);
    childrenUseCase = moduleFixture.get(ListCategoryChildrenUseCase);
    deleteCategory = moduleFixture.get(DeleteCategoryUseCase);
    prisma = moduleFixture.get(OperationalPrismaService);
  });

  afterEach(async () => {
    for (const id of [...createdIds].reverse()) {
      try {
        await deleteCategory.execute(id).catch(async () => {
          await prisma.category.delete({ where: { id } });
        });
      } catch {
        continue;
      }
    }
    createdIds.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a root category with path = self id', async () => {
    const cat = await createCategory.execute({
      name: 'Electrónicos',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: 'h1', type: 'text' },
      ],
    });
    createdIds.push(cat.id);

    expect(cat.name).toBe('Electrónicos');
    expect(cat.defaultFieldMappings).toEqual([
      { canonicalField: 'title', selector: 'h1', type: 'text' },
    ]);
    expect(cat.parentId).toBeNull();
    expect(cat.path).toBe(cat.id);
  });

  it('creates a multi-level category tree and verifies paths', async () => {
    // Build tree: Electrónicos → Computación → Laptops
    const root = await createCategory.execute({ name: 'Electrónicos' });
    createdIds.push(root.id);

    const child = await createCategory.execute({
      name: 'Computación',
      parentId: root.id,
    });
    createdIds.push(child.id);

    const grandchild = await createCategory.execute({
      name: 'Laptops',
      parentId: child.id,
    });
    createdIds.push(grandchild.id);

    expect(child.path).toBe(`${root.id}/${child.id}`);
    expect(grandchild.path).toBe(`${root.id}/${child.id}/${grandchild.id}`);
  });

  it('returns ancestors for deeply nested category', async () => {
    const root = await createCategory.execute({ name: 'Root' });
    createdIds.push(root.id);

    const child = await createCategory.execute({
      name: 'Level 1',
      parentId: root.id,
    });
    createdIds.push(child.id);

    const grandchild = await createCategory.execute({
      name: 'Level 2',
      parentId: child.id,
    });
    createdIds.push(grandchild.id);

    const ancestors = await ancestorsUseCase.execute(grandchild.id);
    expect(ancestors).toHaveLength(2);
    const ancestorIds = ancestors.map((a) => a.id);
    expect(ancestorIds).toContain(root.id);
    expect(ancestorIds).toContain(child.id);
  });

  it('returns empty ancestors for root category', async () => {
    const root = await createCategory.execute({ name: 'Standalone' });
    createdIds.push(root.id);

    const ancestors = await ancestorsUseCase.execute(root.id);
    expect(ancestors).toHaveLength(0);
  });

  it('returns all descendants for a category', async () => {
    const root = await createCategory.execute({ name: 'Parent' });
    createdIds.push(root.id);

    const child = await createCategory.execute({
      name: 'Child',
      parentId: root.id,
    });
    createdIds.push(child.id);

    const grandchild = await createCategory.execute({
      name: 'Grandchild',
      parentId: child.id,
    });
    createdIds.push(grandchild.id);

    const descendants = await descendantsUseCase.execute(root.id);
    expect(descendants).toHaveLength(2);
  });

  it('returns empty descendants for leaf category', async () => {
    const root = await createCategory.execute({ name: 'LeafRoot' });
    createdIds.push(root.id);

    const leaf = await createCategory.execute({
      name: 'Leaf',
      parentId: root.id,
    });
    createdIds.push(leaf.id);

    const descendants = await descendantsUseCase.execute(leaf.id);
    expect(descendants).toHaveLength(0);
  });

  it('returns direct children only', async () => {
    const root = await createCategory.execute({ name: 'BranchNode' });
    createdIds.push(root.id);

    const child1 = await createCategory.execute({
      name: 'Child A',
      parentId: root.id,
    });
    createdIds.push(child1.id);

    const child2 = await createCategory.execute({
      name: 'Child B',
      parentId: root.id,
    });
    createdIds.push(child2.id);

    // Grandchild should NOT appear in direct children
    const grandchild = await createCategory.execute({
      name: 'Grandchild',
      parentId: child1.id,
    });
    createdIds.push(grandchild.id);

    const children = await childrenUseCase.execute(root.id);
    expect(children).toHaveLength(2);
    const childIds = children.map((c) => c.id);
    expect(childIds).toContain(child1.id);
    expect(childIds).toContain(child2.id);
  });

  it('persists name + description + defaultFieldMappings alongside a reparent in one transaction', async () => {
    const oldParent = await createCategory.execute({ name: 'OldRoot' });
    createdIds.push(oldParent.id);
    const newParent = await createCategory.execute({ name: 'NewRoot' });
    createdIds.push(newParent.id);
    const child = await createCategory.execute({
      name: 'OriginalName',
      description: 'Original description',
      parentId: oldParent.id,
    });
    createdIds.push(child.id);

    const newMappings = [
      { canonicalField: 'title', selector: 'h2', type: 'text' as const },
    ];
    const updated = await updateCategory.execute({
      id: child.id,
      name: 'RenamedChild',
      description: 'New description',
      defaultFieldMappings: newMappings,
      parentId: newParent.id,
    });

    expect(updated.name).toBe('RenamedChild');
    expect(updated.parentId).toBe(newParent.id);
    expect(updated.path).toBe(`${newParent.id}/${child.id}`);

    // Verify the persisted row carries every mutable field — guards the
    // contract that reparent() never silently drops field changes.
    const dbRow = await prisma.category.findUnique({ where: { id: child.id } });
    expect(dbRow?.name).toBe('RenamedChild');
    expect(dbRow?.description).toBe('New description');
    expect(dbRow?.defaultFieldMappings).toEqual(newMappings);
    expect(dbRow?.path).toBe(`${newParent.id}/${child.id}`);
  });
});
