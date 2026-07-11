import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/operational';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';
import {
  CreateSourceDto,
  UpdateSourceDto,
} from '@web-scraping/contracts/sources';

/** Valid status transitions: inactive→active, active→error, error→inactive. */
const VALID_TRANSITIONS: Record<string, string[]> = {
  inactive: ['active'],
  active: ['error'],
  error: ['inactive'],
};

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll() {
    return this.prisma.source.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Source with id ${id} not found`);
    }
    return source;
  }

  async findByCode(code: string) {
    return this.prisma.source.findUnique({ where: { code } });
  }

  async create(dto: CreateSourceDto) {
    const existing = await this.prisma.source.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Source with code "${dto.code}" already exists`,
      );
    }

    return this.prisma.source.create({
      data: {
        code: dto.code,
        name: dto.name,
        baseUrl: dto.baseUrl,
        config: dto.config as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateSourceDto) {
    const source = await this.findOne(id);

    // Validate status transition if status is being changed
    if (dto.status && dto.status !== source.status) {
      const allowed = VALID_TRANSITIONS[source.status];
      if (!allowed || !allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition from "${source.status}" to "${dto.status}". ` +
            `Allowed transitions: inactive→active, active→error, error→inactive.`,
        );
      }
    }

    return this.prisma.source.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.status !== undefined && {
          status: dto.status as 'inactive' | 'active' | 'error',
        }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.source.delete({ where: { id } });
  }
}
