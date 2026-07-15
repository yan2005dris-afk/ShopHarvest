import { Injectable } from '@nestjs/common';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import { DomainRule } from '../../domain/domain.entity';
import type { DomainRuleLoadResult } from '../../domain/domains.repository';
import { DomainsRepository } from '../../domain/domains.repository';
import { DomainMapper, PrismaDomainRuleWithCategory } from './domain.mapper';

/**
 * Prisma-backed implementation of `DomainsRepository`.
 *
 * Every read query includes the `category` relation with `id` and `name`
 * so the response mapper can populate the denormalized `categoryName`
 * field on the wire without a second roundtrip. The mapper strips the
 * JOIN before constructing the entity — domain code never sees the
 * `category` relation.
 *
 * `save` is an upsert keyed by id. The caller mints a UUID via
 * `randomUUID()` in the create use case; updates reuse the persisted id.
 */
@Injectable()
export class PrismaDomainsRepository implements DomainsRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(host?: string): Promise<DomainRuleLoadResult[]> {
    const rows: PrismaDomainRuleWithCategory[] =
      await this.prisma.domainRule.findMany({
        where: host ? { domain: host } : undefined,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    return rows.map((row) => ({
      rule: DomainMapper.toDomain(row),
      categoryName: DomainMapper.categoryNameFromRow(row),
    }));
  }

  async findById(id: string): Promise<DomainRuleLoadResult | null> {
    const row: PrismaDomainRuleWithCategory | null =
      await this.prisma.domainRule.findUnique({
        where: { id },
        include: { category: { select: { id: true, name: true } } },
      });
    if (!row) return null;
    return {
      rule: DomainMapper.toDomain(row),
      categoryName: DomainMapper.categoryNameFromRow(row),
    };
  }

  async save(rule: DomainRule): Promise<DomainRuleLoadResult> {
    const fieldMappings = DomainMapper.fieldMappingsToPersistence(
      rule.fieldMappings,
    );
    const row = await this.prisma.domainRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        domain: rule.domain,
        name: rule.name,
        categoryId: rule.categoryId,
        fieldMappings: fieldMappings as never,
        containerSelector: rule.containerSelector,
        productLimit: rule.productLimit,
        sampleUrl: rule.sampleUrl,
        paginationType: rule.paginationType,
        paginationSelector: rule.paginationSelector,
      },
      update: {
        domain: rule.domain,
        name: rule.name,
        categoryId: rule.categoryId,
        fieldMappings: fieldMappings as never,
        containerSelector: rule.containerSelector,
        productLimit: rule.productLimit,
        sampleUrl: rule.sampleUrl,
        paginationType: rule.paginationType,
        paginationSelector: rule.paginationSelector,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    return {
      rule: DomainMapper.toDomain(row),
      categoryName: DomainMapper.categoryNameFromRow(row),
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.domainRule.delete({ where: { id } });
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    const row = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    return row !== null;
  }
}
