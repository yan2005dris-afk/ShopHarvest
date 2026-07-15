import { Category, UpdateCategoryInput } from './category.entity';

describe('Category entity', () => {
  const baseCreateInput = {
    id: 'cat_1',
    name: 'Electronics',
    description: 'Phones, laptops, etc.',
    defaultFieldMappings: [
      { canonicalField: 'title', selector: 'h1', type: 'text' as const },
    ],
  };

  describe('create()', () => {
    it('creates a category with parentId=null and an empty placeholder path', () => {
      const cat = Category.create(
        { id: 'cat_1', name: 'Electronics' },
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(cat.id).toBe('cat_1');
      expect(cat.name).toBe('Electronics');
      expect(cat.description).toBeNull();
      expect(cat.defaultFieldMappings).toBeNull();
      expect(cat.parentId).toBeNull();
      expect(cat.path).toBe('');
      expect(cat.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(cat.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('persists optional fields on create', () => {
      const cat = Category.create(baseCreateInput);
      expect(cat.description).toBe('Phones, laptops, etc.');
      expect(cat.defaultFieldMappings).toEqual([
        { canonicalField: 'title', selector: 'h1', type: 'text' },
      ]);
    });

    it('accepts an explicit parentId at creation time', () => {
      const cat = Category.create({ id: 'cat_1', name: 'X', parentId: 'p' });
      expect(cat.parentId).toBe('p');
    });
  });

  describe('update()', () => {
    it('updates name, description, and field mappings together', () => {
      const cat = Category.create(baseCreateInput);
      const input: UpdateCategoryInput = {
        name: 'Tech',
        description: 'Updated',
        defaultFieldMappings: [
          {
            canonicalField: 'price',
            selector: '.price',
            type: 'text' as const,
          },
        ],
      };
      cat.update(input, new Date('2026-02-01T00:00:00Z'));
      expect(cat.name).toBe('Tech');
      expect(cat.description).toBe('Updated');
      expect(cat.defaultFieldMappings).toEqual([
        { canonicalField: 'price', selector: '.price', type: 'text' },
      ]);
      expect(cat.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('treats undefined fields as a no-op for the field', () => {
      const cat = Category.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      cat.update({}, new Date('2026-02-01T00:00:00Z'));
      expect(cat.name).toBe('Electronics');
      expect(cat.description).toBe('Phones, laptops, etc.');
      expect(cat.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('treats an unchanged name as a no-op (does not bump updatedAt)', () => {
      const cat = Category.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      cat.update(
        { name: 'Electronics', description: 'new desc' },
        new Date('2026-02-01T00:00:00Z'),
      );
      expect(cat.name).toBe('Electronics');
      expect(cat.description).toBe('new desc');
      expect(cat.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('updates parentId when explicitly provided (null = root, value = child)', () => {
      const cat = Category.create(baseCreateInput);
      cat.update({ parentId: 'cat_parent' });
      expect(cat.parentId).toBe('cat_parent');
      cat.update({ parentId: null });
      expect(cat.parentId).toBeNull();
    });

    it('ignores undefined parentId so a missing key is not a reparent', () => {
      const cat = Category.create({
        id: 'cat_1',
        name: 'X',
        parentId: 'old',
      });
      cat.update({ name: 'X' });
      expect(cat.parentId).toBe('old');
    });

    it('allows clearing defaultFieldMappings by passing an empty array', () => {
      const cat = Category.create(baseCreateInput);
      cat.update({ defaultFieldMappings: [] });
      expect(cat.defaultFieldMappings).toEqual([]);
    });
  });

  describe('assignPath()', () => {
    it('overrides the persisted path and bumps updatedAt', () => {
      const cat = Category.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      cat.assignPath('cat_1', new Date('2026-02-01T00:00:00Z'));
      expect(cat.path).toBe('cat_1');
      expect(cat.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });
  });

  describe('toJSON()', () => {
    it('returns a shallow copy with cloned defaultFieldMappings', () => {
      const cat = Category.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const json = cat.toJSON();
      expect(json).toEqual({
        id: 'cat_1',
        name: 'Electronics',
        description: 'Phones, laptops, etc.',
        defaultFieldMappings: [
          { canonicalField: 'title', selector: 'h1', type: 'text' },
        ],
        parentId: null,
        path: '',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      json.defaultFieldMappings![0].canonicalField = 'mutated';
      expect(cat.defaultFieldMappings).toEqual([
        { canonicalField: 'title', selector: 'h1', type: 'text' },
      ]);
    });
  });
});
