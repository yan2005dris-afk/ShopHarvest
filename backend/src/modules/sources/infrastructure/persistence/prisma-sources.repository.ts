import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/operational';
import { OperationalPrismaService } from '../../../../common/prisma/operational-prisma.service';
import { Source } from '../../domain/source.entity';
import { SourcesRepository } from '../../domain/sources.repository';
import { SourceMapper } from './source.mapper';

@Injectable()
export class PrismaSourcesRepository implements SourcesRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(): Promise<Source[]> {
    const rows = await this.prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(SourceMapper.toDomain);
  }

  async findById(id: string): Promise<Source | null> {
    const row = await this.prisma.source.findUnique({ where: { id } });
    return row ? SourceMapper.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Source | null> {
    const row = await this.prisma.source.findUnique({ where: { code } });
    return row ? SourceMapper.toDomain(row) : null;
  }

  async save(source: Source): Promise<Source> {
    const data = SourceMapper.toPersistence(source);
    const row = await this.prisma.source.upsert({
      where: { id: data.id },
      create: {
        ...data,
        config: (data.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      update: {
        code: data.code,
        name: data.name,
        baseUrl: data.baseUrl,
        status: data.status,
        config: (data.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    return SourceMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.source.delete({ where: { id } });
  }
}
