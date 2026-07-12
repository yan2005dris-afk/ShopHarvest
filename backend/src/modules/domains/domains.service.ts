import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/operational';
import {
  CreateDomainDto,
  UpdateDomainDto,
} from '@web-scraping/contracts/domains';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(host?: string) {
    return this.prisma.domainRule.findMany({
      where: host ? { domain: host } : undefined,
      include: {
        offers: true,
        category: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.domainRule.findUnique({
      where: { id },
      include: {
        offers: true,
        category: { select: { id: true, name: true } },
      },
    });
  }

  async create(dto: CreateDomainDto) {
    await this.ensureCategoryExists(dto.categoryId);

    const data: Prisma.DomainRuleUncheckedCreateInput = {
      domain: dto.domain,
      name: dto.name,
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      fieldMappings: dto.fieldMappings as unknown as Prisma.InputJsonValue,
      ...(dto.containerSelector !== undefined && {
        containerSelector: dto.containerSelector,
      }),
      ...(dto.productLimit !== undefined && { productLimit: dto.productLimit }),
      ...(dto.sampleUrl !== undefined && { sampleUrl: dto.sampleUrl }),
    };

    return this.prisma.domainRule.create({ data });
  }

  async update(id: string, dto: UpdateDomainDto) {
    await this.ensureCategoryExists(dto.categoryId);

    const data: Prisma.DomainRuleUncheckedUpdateInput = {
      ...(dto.domain !== undefined && { domain: dto.domain }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.fieldMappings !== undefined && {
        fieldMappings: dto.fieldMappings as unknown as Prisma.InputJsonValue,
      }),
      ...(dto.containerSelector !== undefined && {
        containerSelector: dto.containerSelector,
      }),
      ...(dto.productLimit !== undefined && { productLimit: dto.productLimit }),
      ...(dto.sampleUrl !== undefined && { sampleUrl: dto.sampleUrl }),
    };

    return this.prisma.domainRule.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.domainRule.delete({ where: { id } });
  }

  private async ensureCategoryExists(categoryId?: string | null) {
    if (categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!cat) {
        throw new NotFoundException(
          `Category with id ${categoryId} not found`,
        );
      }
    }
  }
}
