import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.domainRule.findMany({
      include: { products: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.domainRule.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  async create(data: {
    domain: string;
    name: string;
    selectorTitle: string;
    selectorPrice: string;
    selectorImage?: string;
    selectorSku?: string;
    selectorType?: string;
    paginationType?: string;
    paginationSelector?: string;
    sampleUrl?: string;
    fieldMappings?: Record<string, unknown>[];
    containerSelector?: string;
    productLimit?: number;
  }) {
    return this.prisma.domainRule.create({
      data: {
        ...data,
        fieldMappings: data.fieldMappings as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      domain: string;
      name: string;
      selectorTitle: string;
      selectorPrice: string;
      selectorImage: string;
      selectorSku: string;
      selectorType: string;
      paginationType: string;
      paginationSelector: string;
      sampleUrl: string;
      fieldMappings: Record<string, unknown>[];
      containerSelector: string;
      productLimit: number;
    }>,
  ) {
    return this.prisma.domainRule.update({
      where: { id },
      data: {
        ...data,
        fieldMappings: data.fieldMappings as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.domainRule.delete({ where: { id } });
  }
}
