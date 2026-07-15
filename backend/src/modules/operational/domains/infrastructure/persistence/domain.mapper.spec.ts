import { DomainRule } from '../../domain/domain.entity';
import { DomainMapper } from './domain.mapper';
import type { PrismaDomainRuleWithCategory } from './domain.mapper';

describe('DomainMapper', () => {
  describe('toDomain', () => {
    it('maps a Prisma row to a DomainRule with field-mappings parsed', () => {
      const row: PrismaDomainRuleWithCategory = {
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        categoryId: 'cat_electronics',
        fieldMappings: [
          { canonicalField: 'title', selector: '.t', type: 'text' },
        ],
        containerSelector: '.product-card',
        productLimit: 50,
        sampleUrl: 'https://www.temu.com/category-1.html',
        paginationType: 'scroll',
        paginationSelector: 'button.load-more',
        lastScrapedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        sourceId: null,
        category: { id: 'cat_electronics', name: 'Electronics' },
      };

      const rule = DomainMapper.toDomain(row);

      expect(rule.id).toBe('rule_1');
      expect(rule.domain).toBe('temu.com');
      expect(rule.name).toBe('Temu');
      expect(rule.categoryId).toBe('cat_electronics');
      expect(rule.fieldMappings).toEqual([
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ]);
      expect(rule.containerSelector).toBe('.product-card');
      expect(rule.productLimit).toBe(50);
      expect(rule.paginationType).toBe('scroll');
      expect(rule.paginationSelector).toBe('button.load-more');
    });

    it('returns null fieldMappings when the column is null', () => {
      const row = {
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        categoryId: null,
        fieldMappings: null,
        containerSelector: null,
        productLimit: null,
        sampleUrl: null,
        paginationType: 'scroll',
        paginationSelector: null,
        lastScrapedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        sourceId: null,
      } as unknown as PrismaDomainRuleWithCategory;

      expect(DomainMapper.toDomain(row).fieldMappings).toBeNull();
    });

    it('returns null fieldMappings when the column is malformed (non-array)', () => {
      const row = {
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        categoryId: null,
        fieldMappings: { not: 'an array' },
        containerSelector: null,
        productLimit: null,
        sampleUrl: null,
        paginationType: 'scroll',
        paginationSelector: null,
        lastScrapedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        sourceId: null,
      } as unknown as PrismaDomainRuleWithCategory;

      expect(DomainMapper.toDomain(row).fieldMappings).toBeNull();
    });
  });

  describe('categoryNameFromRow', () => {
    it('returns the joined category name when present', () => {
      const row = {
        id: 'rule_1',
        category: { id: 'cat_electronics', name: 'Electronics' },
      } as unknown as PrismaDomainRuleWithCategory;
      expect(DomainMapper.categoryNameFromRow(row)).toBe('Electronics');
    });

    it('returns null when category is null or undefined', () => {
      const withNull = {
        id: 'rule_1',
        category: null,
      } as unknown as PrismaDomainRuleWithCategory;
      const withUndefined = {
        id: 'rule_1',
      } as unknown as PrismaDomainRuleWithCategory;
      expect(DomainMapper.categoryNameFromRow(withNull)).toBeNull();
      expect(DomainMapper.categoryNameFromRow(withUndefined)).toBeNull();
    });
  });

  describe('fieldMappingsToPersistence (round-trip)', () => {
    it('returns null when field mappings are null', () => {
      expect(DomainMapper.fieldMappingsToPersistence(null)).toBeNull();
    });

    it('strips the optional `attribute` field when not provided', () => {
      const out = DomainMapper.fieldMappingsToPersistence([
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ]);
      expect(out).toEqual([
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ]);
    });

    it('keeps the `attribute` field when provided (type=attribute)', () => {
      const out = DomainMapper.fieldMappingsToPersistence([
        {
          canonicalField: 'image',
          selector: 'img',
          type: 'attribute',
          attribute: 'src',
        },
      ]);
      expect(out).toEqual([
        {
          canonicalField: 'image',
          selector: 'img',
          type: 'attribute',
          attribute: 'src',
        },
      ]);
    });

    it('round-trips: toDomain → toPersistence → toDomain preserves shape', () => {
      const rule = DomainRule.create({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        fieldMappings: [
          { canonicalField: 'title', selector: '.t', type: 'text' },
          {
            canonicalField: 'image',
            selector: 'img',
            type: 'attribute',
            attribute: 'src',
          },
        ],
      });

      const persisted = DomainMapper.fieldMappingsToPersistence(
        rule.fieldMappings,
      );
      const reloaded = DomainMapper.toDomain({
        id: rule.id,
        domain: rule.domain,
        name: rule.name,
        categoryId: rule.categoryId,
        fieldMappings: persisted as never,
        containerSelector: rule.containerSelector,
        productLimit: rule.productLimit,
        sampleUrl: rule.sampleUrl,
        paginationType: rule.paginationType,
        paginationSelector: rule.paginationSelector,
        lastScrapedAt: rule.lastScrapedAt,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
        sourceId: null,
      });

      expect(reloaded.fieldMappings).toEqual(rule.fieldMappings);
    });
  });
});
