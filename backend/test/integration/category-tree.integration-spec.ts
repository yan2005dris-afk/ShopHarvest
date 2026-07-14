import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { CategoriesService } from '../../src/modules/operational/categories/categories.service';

/**
 * Cleanup helper — deletes all categories created during the test run by
 * walking the created IDs in reverse order (children before parents, since
 * the FK constraint prevents deleting a parent with existing children).
 */
async function cleanupCategories(
  service: CategoriesService,
  ids: string[],
): Promise<void> {
  const prisma = (service as any).prisma;
  // Delete in reverse order so children are removed before parents
  for (const id of ids.reverse()) {
    try {
      await prisma.category.delete({ where: { id } });
    } catch {
      // Already deleted or FK-protected — skip
    }
  }
}

describe('Category Tree (integration)', () => {
  let app: INestApplication;
  let categoriesService: CategoriesService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    categoriesService = moduleFixture.get(CategoriesService);
  });

  afterAll(async () => {
    await cleanupCategories(categoriesService, createdIds);
    await app.close();
  });

  it('creates a root category with path = self id', async () => {
    const cat = await categoriesService.create({ name: 'Electrónicos' });
    createdIds.push(cat.id);

    expect(cat.name).toBe('Electrónicos');
    expect(cat.parentId).toBeNull();
    expect(cat.path).toBe(cat.id);
  });

  it('creates a multi-level category tree and verifies paths', async () => {
    // Build tree: Electrónicos → Computación → Laptops
    const root = await categoriesService.create({ name: 'Electrónicos' });
    createdIds.push(root.id);

    const child = await categoriesService.create({
      name: 'Computación',
      parentId: root.id,
    });
    createdIds.push(child.id);

    const grandchild = await categoriesService.create({
      name: 'Laptops',
      parentId: child.id,
    });
    createdIds.push(grandchild.id);

    expect(child.path).toBe(`${root.id}/${child.id}`);
    expect(grandchild.path).toBe(`${root.id}/${child.id}/${grandchild.id}`);
  });

  it('returns ancestors for deeply nested category', async () => {
    const root = await categoriesService.create({ name: 'Root' });
    createdIds.push(root.id);

    const child = await categoriesService.create({
      name: 'Level 1',
      parentId: root.id,
    });
    createdIds.push(child.id);

    const grandchild = await categoriesService.create({
      name: 'Level 2',
      parentId: child.id,
    });
    createdIds.push(grandchild.id);

    const ancestors = await categoriesService.getAncestors(grandchild.id);
    expect(ancestors).toHaveLength(2);
    const ancestorIds = ancestors.map((a) => a.id);
    expect(ancestorIds).toContain(root.id);
    expect(ancestorIds).toContain(child.id);
  });

  it('returns empty ancestors for root category', async () => {
    const root = await categoriesService.create({ name: 'Standalone' });
    createdIds.push(root.id);

    const ancestors = await categoriesService.getAncestors(root.id);
    expect(ancestors).toHaveLength(0);
  });

  it('returns all descendants for a category', async () => {
    const root = await categoriesService.create({ name: 'Parent' });
    createdIds.push(root.id);

    const child = await categoriesService.create({
      name: 'Child',
      parentId: root.id,
    });
    createdIds.push(child.id);

    const grandchild = await categoriesService.create({
      name: 'Grandchild',
      parentId: child.id,
    });
    createdIds.push(grandchild.id);

    const descendants = await categoriesService.getDescendants(root.id);
    expect(descendants).toHaveLength(2);
  });

  it('returns empty descendants for leaf category', async () => {
    const root = await categoriesService.create({ name: 'LeafRoot' });
    createdIds.push(root.id);

    const leaf = await categoriesService.create({
      name: 'Leaf',
      parentId: root.id,
    });
    createdIds.push(leaf.id);

    const descendants = await categoriesService.getDescendants(leaf.id);
    expect(descendants).toHaveLength(0);
  });

  it('returns direct children only', async () => {
    const root = await categoriesService.create({ name: 'BranchNode' });
    createdIds.push(root.id);

    const child1 = await categoriesService.create({
      name: 'Child A',
      parentId: root.id,
    });
    createdIds.push(child1.id);

    const child2 = await categoriesService.create({
      name: 'Child B',
      parentId: root.id,
    });
    createdIds.push(child2.id);

    // Grandchild should NOT appear in direct children
    const grandchild = await categoriesService.create({
      name: 'Grandchild',
      parentId: child1.id,
    });
    createdIds.push(grandchild.id);

    const children = await categoriesService.getChildren(root.id);
    expect(children).toHaveLength(2);
    const childIds = children.map((c) => c.id);
    expect(childIds).toContain(child1.id);
    expect(childIds).toContain(child2.id);
  });
});
