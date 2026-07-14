import { Brand, UpdateBrandInput } from './brand.entity';

describe('Brand entity', () => {
  const baseCreateInput = {
    id: 'brd_1',
    name: 'Samsung',
    aliases: ['Sam', 'SSG'],
  };

  describe('create()', () => {
    it('creates a brand with name and defaults aliases to empty array', () => {
      const brand = Brand.create(
        { id: 'brd_1', name: 'Samsung' },
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(brand.id).toBe('brd_1');
      expect(brand.name).toBe('Samsung');
      expect(brand.aliases).toEqual([]);
      expect(brand.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(brand.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('persists provided aliases on create', () => {
      const brand = Brand.create(baseCreateInput);
      expect(brand.aliases).toEqual(['Sam', 'SSG']);
    });
  });

  describe('update()', () => {
    it('updates name and aliases together', () => {
      const brand = Brand.create(baseCreateInput);
      const input: UpdateBrandInput = {
        name: 'Samsung Electronics',
        aliases: ['SE', 'Sam'],
      };
      brand.update(input, new Date('2026-02-01T00:00:00Z'));
      expect(brand.name).toBe('Samsung Electronics');
      expect(brand.aliases).toEqual(['SE', 'Sam']);
      expect(brand.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('is a no-op when name is unchanged and aliases omitted', () => {
      const brand = Brand.create(baseCreateInput, new Date('2026-01-01T00:00:00Z'));
      const before = brand.updatedAt;
      brand.update({}, new Date('2026-02-01T00:00:00Z'));
      expect(brand.updatedAt).toBe(before);
    });

    it('treats an unchanged name as a no-op for the field (does not bump updatedAt unless something else changes)', () => {
      const brand = Brand.create(baseCreateInput, new Date('2026-01-01T00:00:00Z'));
      const before = brand.updatedAt;
      brand.update({ name: 'Samsung' }, new Date('2026-02-01T00:00:00Z'));
      expect(brand.updatedAt).toBe(before);
    });

    it('bumps updatedAt only when aliases are explicitly changed', () => {
      const brand = Brand.create(baseCreateInput, new Date('2026-01-01T00:00:00Z'));
      brand.update({ aliases: ['SE'] }, new Date('2026-02-01T00:00:00Z'));
      expect(brand.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('allows clearing aliases by passing an empty array', () => {
      const brand = Brand.create(baseCreateInput);
      brand.update({ aliases: [] });
      expect(brand.aliases).toEqual([]);
    });
  });

  describe('toJSON()', () => {
    it('returns a shallow copy of the props with a copied aliases array', () => {
      const brand = Brand.create(baseCreateInput, new Date('2026-01-01T00:00:00Z'));
      const json = brand.toJSON();
      expect(json).toEqual({
        id: 'brd_1',
        name: 'Samsung',
        aliases: ['Sam', 'SSG'],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      json.aliases.push('mutated');
      expect(brand.aliases).toEqual(['Sam', 'SSG']);
    });
  });
});
