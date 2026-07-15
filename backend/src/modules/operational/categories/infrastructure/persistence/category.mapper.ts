import {
  Prisma,
  type Category as PrismaCategory,
} from '../../../../../generated/operational';
import { Category } from '../../domain/category.entity';
import type {
  CategoryDefaultFieldMappings,
  CategoryProps,
} from '../../domain/category.entity';

interface CategoryPersistenceData {
  id: string;
  name: string;
  description: string | null;
  defaultFieldMappings:
    | Prisma.NullableJsonNullValueInput
    | Prisma.InputJsonValue;
  parentId: string | null;
  path: string;
}

/**
 * Maps a Prisma `categories` row to a Category domain entity and back.
 *
 * The Prisma `defaultFieldMappings` column is `Json?`; the contracts DTO
 * validation guarantees an array of `FieldMappingDto` on the way in, so
 * the mapper can narrow the JSON column through a runtime shape check.
 * The mapper is the single point where that narrowing happens — domain
 * code and use cases only ever see `CategoryDefaultFieldMappings | null`.
 */
export class CategoryMapper {
  static toDomain(row: PrismaCategory): Category {
    const props: CategoryProps = {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultFieldMappings: CategoryMapper.parseFieldMappings(
        row.defaultFieldMappings,
      ),
      parentId: row.parentId,
      path: row.path,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Category.fromPersistence(props);
  }

  static toPersistence(category: Category): CategoryPersistenceData {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      defaultFieldMappings: CategoryMapper.toPersistenceFieldMappings(
        category.defaultFieldMappings,
      ),
      parentId: category.parentId,
      path: category.path,
    };
  }

  private static toPersistenceFieldMappings(
    mappings: CategoryDefaultFieldMappings | null,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    if (mappings === null) return Prisma.DbNull;

    const jsonMappings: Prisma.InputJsonArray = mappings.map((mapping) => ({
      canonicalField: mapping.canonicalField,
      selector: mapping.selector,
      type: mapping.type,
      ...(mapping.attribute === undefined
        ? {}
        : { attribute: mapping.attribute }),
    }));
    return jsonMappings;
  }

  private static parseFieldMappings(
    raw: unknown,
  ): CategoryDefaultFieldMappings | null {
    if (raw === null || raw === undefined) return null;
    if (!Array.isArray(raw)) return null;
    return raw as CategoryDefaultFieldMappings;
  }
}
