import { Injectable } from '@nestjs/common';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import type {
  CategorySourceMapping,
  CategorySourceMappingsRepository,
  CategorySourceMappingWithSource,
} from '../../domain/category-source-mappings.repository';
import { CategorySourceMappingMapper } from './category-source-mapping.mapper';

/**
 * Prisma-backed implementation of the mappings port. Reads always include
 * the `source` relation so the controller can render the lightweight
 * `{id, code, name}` projection the legacy service returned.
 */
@Injectable()
export class PrismaCategorySourceMappingsRepository implements CategorySourceMappingsRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findByKey(
    categoryId: string,
    sourceId: string,
  ): Promise<CategorySourceMapping | null> {
    const row = await this.prisma.categorySourceMapping.findUnique({
      where: { categoryId_sourceId: { categoryId, sourceId } },
    });
    return row ? CategorySourceMappingMapper.toDomain(row) : null;
  }

  async findByCategory(
    categoryId: string,
  ): Promise<CategorySourceMappingWithSource[]> {
    const rows = await this.prisma.categorySourceMapping.findMany({
      where: { categoryId },
      include: { source: true },
    });
    return rows.map((row) =>
      CategorySourceMappingMapper.toDomainWithSource(row),
    );
  }

  async create(input: CategorySourceMapping): Promise<CategorySourceMapping> {
    const data = CategorySourceMappingMapper.toPersistence(input);
    const row = await this.prisma.categorySourceMapping.create({ data });
    return CategorySourceMappingMapper.toDomain(row);
  }

  async delete(categoryId: string, sourceId: string): Promise<void> {
    await this.prisma.categorySourceMapping.delete({
      where: { categoryId_sourceId: { categoryId, sourceId } },
    });
  }
}
