import { Prisma } from '../../../../../generated/operational';
import { Category } from '../../domain/category.entity';
import type { CategoryDefaultFieldMappings } from '../../domain/category.entity';
import { CategoryMapper } from './category.mapper';

const buildCategory = (
  defaultFieldMappings: CategoryDefaultFieldMappings | null,
): Category =>
  Category.fromPersistence({
    id: 'category-id',
    name: 'Electronics',
    description: null,
    defaultFieldMappings,
    parentId: null,
    path: 'category-id',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

describe('CategoryMapper', () => {
  it('converts domain null to a database NULL JSON input', () => {
    const data = CategoryMapper.toPersistence(buildCategory(null));

    expect(data.defaultFieldMappings).toBe(Prisma.DbNull);
  });

  it('preserves the field-mapping JSON shape', () => {
    const data = CategoryMapper.toPersistence(
      buildCategory([
        { canonicalField: 'title', selector: 'h1', type: 'text' },
        {
          canonicalField: 'image',
          selector: 'img',
          type: 'attribute',
          attribute: 'src',
        },
      ]),
    );

    expect(data.defaultFieldMappings).toEqual([
      { canonicalField: 'title', selector: 'h1', type: 'text' },
      {
        canonicalField: 'image',
        selector: 'img',
        type: 'attribute',
        attribute: 'src',
      },
    ]);
  });
});
