import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';
import {
  CreateBrandDto,
  UpdateBrandDto,
} from '@web-scraping/contracts/brands';

/**
 * Fuzzy-match result from the raw SQL query.
 */
type FuzzyBrandRow = {
  id: string;
  name: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
  sim: number;
};

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }
    return brand;
  }

  async create(dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Brand with name "${dto.name}" already exists`,
      );
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        aliases: dto.aliases,
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto) {
    const brand = await this.findOne(id);

    // If renaming, check for conflicts (excluding self)
    if (dto.name !== undefined && dto.name !== brand.name) {
      const existing = await this.prisma.brand.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(
          `Brand with name "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.aliases !== undefined && { aliases: dto.aliases }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.brand.delete({ where: { id } });
  }

  /**
   * Fuzzy-match brands by name using pg_trgm similarity().
   * Returns brands with similarity > threshold, ordered by similarity DESC.
   * Results with similarity between 0.6 and 0.75 are flagged lowConfidence.
   */
  async fuzzyMatch(
    query: string,
    threshold = 0.6,
  ): Promise<
    Array<{
      brand: {
        id: string;
        name: string;
        aliases: string[];
        createdAt: Date;
        updatedAt: Date;
      };
      similarity: number;
      lowConfidence: boolean;
    }>
  > {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<FuzzyBrandRow[]>`
      SELECT
        b.id,
        b.name,
        b.aliases,
        b.created_at,
        b.updated_at,
        similarity(b.name, ${query}) AS sim
      FROM "brands" b
      WHERE similarity(b.name, ${query}) > ${threshold}
      ORDER BY sim DESC
    `;

    return rows.map((row) => ({
      brand: {
        id: row.id,
        name: row.name,
        aliases: row.aliases,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      similarity: Number(row.sim.toFixed(4)),
      lowConfidence: row.sim > 0.6 && row.sim < 0.75,
    }));
  }
}
