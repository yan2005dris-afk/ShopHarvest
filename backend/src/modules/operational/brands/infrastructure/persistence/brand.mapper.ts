import { Brand, BrandProps } from '../../domain/brand.entity';
import { Brand as PrismaBrand } from '../../../../../generated/operational';

/** Maps a Prisma row to a Brand domain entity and back. */
export class BrandMapper {
  static toDomain(row: PrismaBrand): Brand {
    const props: BrandProps = {
      id: row.id,
      name: row.name,
      aliases: (row.aliases ?? []) as string[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Brand.fromPersistence(props);
  }

  static toPersistence(brand: Brand): {
    id: string;
    name: string;
    aliases: string[];
  } {
    return {
      id: brand.id,
      name: brand.name,
      aliases: brand.aliases,
    };
  }
}
