import { DomainRule } from './domain.entity';
import type {
  CreateDomainRuleInput,
  DomainFieldMappings,
  UpdateDomainRuleInput,
} from './domain.entity';

describe('DomainRule entity', () => {
  const baseCreateInput: CreateDomainRuleInput = {
    id: 'rule_1',
    domain: 'temu.com',
    name: 'Temu',
    fieldMappings: [{ canonicalField: 'title', selector: '.t', type: 'text' }],
    containerSelector: '.product-card',
    productLimit: 50,
    sampleUrl: 'https://www.temu.com/category-1.html',
    paginationSelector: 'button.load-more',
  };

  describe('create()', () => {
    it('creates a domain rule with default pagination type "scroll"', () => {
      const rule = DomainRule.create(
        { id: 'rule_1', domain: 'temu.com', name: 'Temu' },
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(rule.id).toBe('rule_1');
      expect(rule.domain).toBe('temu.com');
      expect(rule.name).toBe('Temu');
      expect(rule.categoryId).toBeNull();
      expect(rule.fieldMappings).toBeNull();
      expect(rule.containerSelector).toBeNull();
      expect(rule.productLimit).toBeNull();
      expect(rule.sampleUrl).toBeNull();
      expect(rule.paginationType).toBe('scroll');
      expect(rule.paginationSelector).toBeNull();
      expect(rule.lastScrapedAt).toBeNull();
      expect(rule.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(rule.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('preserves an explicit paginationType override', () => {
      const rule = DomainRule.create({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        paginationType: 'page-number',
      });
      expect(rule.paginationType).toBe('page-number');
    });

    it('preserves every optional field on create', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(rule.categoryId).toBeNull();
      expect(rule.fieldMappings).toEqual([
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ]);
      expect(rule.containerSelector).toBe('.product-card');
      expect(rule.productLimit).toBe(50);
      expect(rule.sampleUrl).toBe('https://www.temu.com/category-1.html');
      expect(rule.paginationSelector).toBe('button.load-more');
    });

    it('accepts an explicit categoryId on create', () => {
      const rule = DomainRule.create({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        categoryId: 'cat_electronics',
      });
      expect(rule.categoryId).toBe('cat_electronics');
    });
  });

  describe('update()', () => {
    it('updates fields and bumps updatedAt when something changed', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const input: UpdateDomainRuleInput = {
        name: 'Temu (renamed)',
        productLimit: 100,
      };
      rule.update(input, new Date('2026-02-01T00:00:00Z'));
      expect(rule.name).toBe('Temu (renamed)');
      expect(rule.productLimit).toBe(100);
      expect(rule.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('treats undefined fields as no-ops (does not null-out untouched fields)', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const before = rule.updatedAt;
      rule.update({ name: 'Renamed' });
      expect(rule.containerSelector).toBe('.product-card');
      expect(rule.productLimit).toBe(50);
      expect(rule.sampleUrl).toBe('https://www.temu.com/category-1.html');
      expect(rule.paginationSelector).toBe('button.load-more');
      expect(rule.updatedAt).not.toBe(before);
    });

    it('nulls a field when explicitly passed as null', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      rule.update({
        categoryId: null,
        containerSelector: null,
        productLimit: null,
      });
      expect(rule.categoryId).toBeNull();
      expect(rule.containerSelector).toBeNull();
      expect(rule.productLimit).toBeNull();
    });

    it('replaces fieldMappings with a fresh array when provided', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const next: DomainFieldMappings = [
        { canonicalField: 'price', selector: '.price', type: 'text' },
        {
          canonicalField: 'image',
          selector: 'img',
          type: 'attribute',
          attribute: 'src',
        },
      ];
      rule.update({ fieldMappings: next });
      expect(rule.fieldMappings).toEqual(next);
    });

    it('clears fieldMappings when explicitly passed as null', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      rule.update({ fieldMappings: null });
      expect(rule.fieldMappings).toBeNull();
    });

    it('changes paginationType when explicitly provided', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      rule.update({ paginationType: 'page-number' });
      expect(rule.paginationType).toBe('page-number');
    });

    it('does not bump updatedAt when no field actually changed', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const before = rule.updatedAt;
      rule.update(
        { name: 'Temu', domain: 'temu.com' },
        new Date('2026-02-01T00:00:00Z'),
      );
      expect(rule.updatedAt).toBe(before);
    });
  });

  describe('markScraped()', () => {
    it('stamps lastScrapedAt and bumps updatedAt', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      rule.markScraped(new Date('2026-03-01T00:00:00Z'));
      expect(rule.lastScrapedAt).toEqual(new Date('2026-03-01T00:00:00Z'));
      expect(rule.updatedAt).toEqual(new Date('2026-03-01T00:00:00Z'));
    });
  });

  describe('toJSON()', () => {
    it('returns a deep clone of the fieldMappings array', () => {
      const rule = DomainRule.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const json = rule.toJSON();
      expect(json.fieldMappings).toEqual([
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ]);
      expect(json.fieldMappings).not.toBe(rule.fieldMappings);
    });

    it('returns null fieldMappings when none were set', () => {
      const rule = DomainRule.create({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
      });
      expect(rule.toJSON().fieldMappings).toBeNull();
    });
  });
});
