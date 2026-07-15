import { Injectable } from '@nestjs/common';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import { Brand } from '../../domain/brand.entity';
import {
  BrandsRepository,
  FuzzyMatchCandidate,
  FuzzyMatchQuery,
} from '../../domain/brands.repository';
import { BrandMapper } from './brand.mapper';

/**
 * Row shape returned by the pg_trgm `$queryRaw` fuzzy-match query.
 * `aliases` is Postgres `text[]` which the Prisma adapter deserializes to
 * `string[]`; `sim` is the `similarity()` score (a real number, possibly
 * serialized as a string depending on the driver — see `.toFixed()` below).
 */
interface FuzzyBrandRow {
  id: string;
  name: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
  sim: number;
}

const LOW_CONFIDENCE_LO = 0.6;
const LOW_CONFIDENCE_HI = 0.75;

@Injectable()
export class PrismaBrandsRepository implements BrandsRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(): Promise<Brand[]> {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(BrandMapper.toDomain);
  }

  async findById(id: string): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({ where: { id } });
    return row ? BrandMapper.toDomain(row) : null;
  }

  async findByName(name: string): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({ where: { name } });
    return row ? BrandMapper.toDomain(row) : null;
  }

  async save(brand: Brand): Promise<Brand> {
    const data = BrandMapper.toPersistence(brand);
    const row = await this.prisma.brand.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        name: data.name,
        aliases: data.aliases,
      },
      update: {
        name: data.name,
        aliases: data.aliases,
      },
    });
    return BrandMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.brand.delete({ where: { id } });
  }

  /**
   * Fuzzy-match brands by name using pg_trgm similarity().
   * Returns brands with similarity > threshold, ordered by similarity DESC.
   * Results with similarity in (0.6, 0.75) are flagged lowConfidence.
   */
  async fuzzyMatch(input: FuzzyMatchQuery): Promise<FuzzyMatchCandidate[]> {
    const threshold = input.threshold ?? 0.6;
    const rows = await this.prisma.$queryRaw<FuzzyBrandRow[]>`
      SELECT
        b.id,
        b.name,
        b.aliases,
        b.created_at,
        b.updated_at,
        similarity(b.name, ${input.query}) AS sim
      FROM "brands" b
      WHERE similarity(b.name, ${input.query}) > ${threshold}
      ORDER BY sim DESC
    `;

    return rows.map((row) => {
      const similarity = Number(row.sim);
      return {
        brand: BrandMapper.toDomain({
          id: row.id,
          name: row.name,
          aliases: row.aliases,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }),
        similarity: Number(similarity.toFixed(4)),
        lowConfidence:
          similarity > LOW_CONFIDENCE_LO && similarity < LOW_CONFIDENCE_HI,
      };
    });
  }
}
