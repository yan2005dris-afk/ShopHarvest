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
  ProductLoadOptions,
  ProductsRepository,
} from '../../domain/products.repository';
import { ProductMapper } from './product.mapper';
import type { PrismaProductWithOffers } from './product.mapper';

/**
 * Prisma-backed implementation of `ProductsRepository`.
 *
 * Owns the canonical ingest transaction: a single `$transaction` walks
 * Source upsert → DomainRule upsert/backfill → per item Product+Offer
 * upsert, PriceObservation create, RawCapture upsert. All five writes
 * share atomic semantics, so a partial ingest never leaves dangling
 * captures or observations.
 *
 * The use case pre-derives `IngestItem`s from the inbound payload +
 * field mappings; this class just persists. Reads reconstruct the
 * `Product` aggregate through the mapper (the legacy
 * `findUnique({ include: { offers: { include: { priceObservations } } } })`
 * shape minus the live `Decimal` instances).
 */
@Injectable()
export class PrismaProductsRepository implements ProductsRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(options: ProductLoadOptions) {
    const rows: PrismaProductWithOffers[] = await this.prisma.product.findMany({
      include: {
        offers: {
          include: { priceObservations: options.includeHistory },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ProductMapper.toDomain(row));
  }

  async findById(id: string, options: ProductLoadOptions) {
    const row: PrismaProductWithOffers | null =
      await this.prisma.product.findUnique({
        where: { id },
        include: {
          offers: {
            include: { priceObservations: options.includeHistory },
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
      // 1. Upsert Source keyed by code = domain. The legacy service
      // derived `baseUrl = https://{domain}` here; preserve that.
      const source =
        (await tx.source.findUnique({ where: { code: command.domain } })) ??
        (await tx.source.create({
          data: {
            code: command.domain,
            name: command.domain,
            baseUrl: `https://${command.domain}`,
          },
        }));

      // 2. Resolve/create DomainRule with backfill semantics. UI-edited
      // field mappings are NEVER overwritten; we only backfill when
      // the stored rule has none yet.
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
                fieldMappings:
                  command.fieldMappings as unknown as Prisma.InputJsonValue,
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
          // Re-ingest of the same (sourceId, url) pair: update the
          // existing Offer + its canonical Product, do NOT create a
          // duplicate (spec: "Re-ingesting the same pair updates, not
          // duplicates").
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
          // New (sourceId, url) pair: create a new Product and a new
          // Offer — no cross-source/cross-item dedup (spec: "One Offer
          // Per Ingested Item").
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

        // RawCapture — real FK to Offer (design.md Decision 2). Written
        // inline via the same `tx`, not `RawCapturesService` (separate
        // connection, would break atomicity).
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
