import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import {
  Prisma,
  RawCaptureStatus,
  type Offer as PrismaOffer,
  type Product as PrismaProduct,
} from '../../../../../generated/operational';
import type { CreateOfferInput } from '../../domain/offer.entity';
import type { PriceObservation as DomainPriceObservation } from '../../domain/price-observation.entity';
import type {
  IngestCommand,
  IngestResult,
  ProductListQuery,
  ProductLoadOptions,
  ProductsRepository,
} from '../../domain/products.repository';
import type { Product } from '../../domain/product.entity';
import { ProductMapper } from './product.mapper';
import type { PrismaProductWithOffers } from './product.mapper';

/**
 * Prisma-backed implementation of `ProductsRepository`.
 */
@Injectable()
export class PrismaProductsRepository implements ProductsRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(query: ProductListQuery): Promise<{ items: Product[]; total: number }> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;
    const q = query.q?.trim();

    const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : '';
    const filter: Prisma.Sql = q
      ? Prisma.sql`WHERE public.f_unaccent(lower(p."title")) LIKE public.f_unaccent(lower(${like}))`
      : Prisma.empty;

    const [idRows, totals] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p."id" FROM "Product" p
        ${filter}
        ORDER BY p."updatedAt" DESC, p."id" DESC
        LIMIT ${limit} OFFSET ${skip}`),
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total FROM "Product" p ${filter}`),
    ]);

    const ids = idRows.map((r) => r.id);
    const total = Number(totals[0]?.total ?? 0);
    if (ids.length === 0) return { items: [], total };

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: { offers: true },
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [ProductMapper.toDomain(row)] : [];
    });
    return { items, total };
  }

  async findById(id: string, options?: ProductLoadOptions) {
    const row: PrismaProductWithOffers | null =
      await this.prisma.product.findUnique({
        where: { id },
        include: {
          offers: {
            include: { priceObservations: options?.includeHistory ?? false },
          },
        },
      });
    return row ? ProductMapper.toDomain(row) : null;
  }

  async findAllByDomainRule(domainRuleId: string) {
    const rows: PrismaProductWithOffers[] = await this.prisma.product.findMany({
      where: { offers: { some: { domainRuleId } } },
      include: {
        offers: {
          where: { domainRuleId },
          include: { priceObservations: true },
        },
      },
    });
    return rows.map((row) => ProductMapper.toDomain(row));
  }

  async findPriceHistory(
    productId: string,
    range?: { from?: Date; to?: Date },
  ): Promise<DomainPriceObservation[]> {
    const where: Prisma.PriceObservationWhereInput = {
      offer: { productId },
    };
    if (range?.from || range?.to) {
      where.observedAt = {
        ...(range.from && { gte: range.from }),
        ...(range.to && { lte: range.to }),
      };
    }
    const rows = await this.prisma.priceObservation.findMany({
      where,
      orderBy: { observedAt: 'desc' },
    });
    return rows.map((row) => ProductMapper.priceObservationToDomain(row));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  async ingest(command: IngestCommand): Promise<IngestResult> {
    return this.prisma.$transaction(async (tx) => {
      const source =
        (await tx.source.findUnique({ where: { code: command.domain } })) ??
        (await tx.source.create({
          data: {
            code: command.domain,
            name: command.domain,
            baseUrl: `https://${command.domain}`,
          },
        }));

      let domainRule = await tx.domainRule.findUnique({
        where: { domain: command.domain },
      });

      const hasIncomingMappings = command.fieldMappings.length > 0;

      if (!domainRule) {
        domainRule = await tx.domainRule.create({
          data: {
            domain: command.domain,
            name: command.domain,
            categoryId: command.categoryId ?? null,
            fieldMappings:
              (command.fieldMappings as unknown as Prisma.InputJsonValue) ??
              Prisma.JsonNull,
            sourceId: source.id,
          },
        });
      } else {
        const storedMappings =
          (domainRule.fieldMappings as unknown as unknown[]) ?? [];
        const needsMappingsBackfill =
          storedMappings.length === 0 && hasIncomingMappings;
        const needsSourceBackfill = domainRule.sourceId == null;
        const needsCategoryBackfill =
          command.categoryId != null && domainRule.categoryId == null;

        if (
          needsMappingsBackfill ||
          needsSourceBackfill ||
          needsCategoryBackfill
        ) {
          domainRule = await tx.domainRule.update({
            where: { id: domainRule.id },
            data: {
              ...(needsMappingsBackfill && {
                fieldMappings: command.fieldMappings,
              }),
              ...(needsSourceBackfill && { sourceId: source.id }),
              ...(needsCategoryBackfill && {
                categoryId: command.categoryId,
              }),
            },
          });
        }
      }

      let ingested = 0;

      for (const item of command.items) {
        const existingOffer = await tx.offer.findUnique({
          where: { sourceId_url: { sourceId: source.id, url: item.url } },
        });

        let offer: PrismaOffer;
        if (existingOffer) {
          offer = await tx.offer.update({
            where: { id: existingOffer.id },
            data: {
              price: item.price,
              currency: item.currency,
              sku: item.sku ?? undefined,
              rawData: (item.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              extractedAt: new Date(),
            },
          });
          await tx.product.update({
            where: { id: existingOffer.productId },
            data: {
              title: item.title,
              description: item.description ?? undefined,
              imageUrl: item.imageUrl ?? undefined,
            },
          });
        } else {
          const createdProduct: PrismaProduct = await tx.product.create({
            data: {
              id: randomUUID(),
              title: item.title,
              description: item.description ?? null,
              imageUrl: item.imageUrl ?? null,
            },
          });
          const offerInput: CreateOfferInput = {
            id: randomUUID(),
            productId: createdProduct.id,
            sourceId: source.id,
            domainRuleId: domainRule.id,
            url: item.url,
            currency: item.currency,
            price: item.price,
            sku: item.sku ?? null,
            rawData: item.raw,
          };
          offer = await tx.offer.create({
            data: ProductMapper.newOfferPersistence(offerInput),
          });
        }

        await tx.priceObservation.create({
          data: {
            id: randomUUID(),
            offerId: offer.id,
            price: item.price,
            currency: item.currency,
          },
        });

        await tx.rawCapture.upsert({
          where: {
            offerId_sourceId: {
              offerId: offer.id,
              sourceId: source.id,
            },
          },
          create: {
            offerId: offer.id,
            sourceId: source.id,
            payload: (item.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            status: RawCaptureStatus.UNPROCESSED,
            attempts: 0,
          },
          update: {
            payload: (item.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            capturedAt: new Date(),
            status: RawCaptureStatus.UNPROCESSED,
            attempts: 0,
          },
        });

        ingested += 1;
      }

      return { ingested, domainRuleId: domainRule.id };
    });
  }
}
