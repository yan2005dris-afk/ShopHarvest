import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDomainDto, UpdateDomainDto } from './dto';

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(host?: string) {
    return this.prisma.domainRule.findMany({
      where: host ? { domain: host } : undefined,
      include: { products: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.domainRule.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  async create(dto: CreateDomainDto) {
    const data: Prisma.DomainRuleUncheckedCreateInput = {
      domain: dto.domain,
      name: dto.name,
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
    const data: Prisma.DomainRuleUncheckedUpdateInput = {
      ...(dto.domain !== undefined && { domain: dto.domain }),
      ...(dto.name !== undefined && { name: dto.name }),
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
}
