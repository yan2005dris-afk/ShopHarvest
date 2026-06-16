import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      include: { domainRule: true, priceHistory: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { domainRule: true, priceHistory: true },
    });
  }

  async findByDomain(domainRuleId: string) {
    return this.prisma.product.findMany({
      where: { domainRuleId },
      include: { priceHistory: true },
    });
  }

  async create(data: {
    domainRuleId: string;
    externalId?: string;
    title: string;
    price: number;
    currency?: string;
    imageUrl?: string;
    productUrl: string;
    sku?: string;
    description?: string;
    rawData?: Prisma.InputJsonValue;
  }) {
    return this.prisma.product.create({ data });
  }

  async remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
