import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpsertProductDto } from './dto/upsert-product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeHistory = true) {
    return this.prisma.product.findMany({
      include: {
        domainRule: true,
        priceHistory: includeHistory,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAllByDomain(domainRuleId: string) {
    return this.prisma.product.findMany({
      where: { domainRuleId },
      include: { priceHistory: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { domainRule: true, priceHistory: true },
    });
  }

  /**
   * Upsert a product by productUrl + domainRuleId.
   * If found: update fields.
   * If not found: create.
   * In both cases: create a new PriceHistory entry.
   */
  async upsert(dto: UpsertProductDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find existing product by productUrl + domainRuleId
      const existing = await tx.product.findFirst({
        where: {
          productUrl: dto.productUrl,
          domainRuleId: dto.domainRuleId,
        },
      });

      const price = dto.price ?? 0;

      if (existing) {
        // Update existing product
        const updated = await tx.product.update({
          where: { id: existing.id },
          data: {
            title: dto.title ?? existing.title,
            price,
            currency: dto.currency ?? existing.currency,
            imageUrl: dto.imageUrl ?? existing.imageUrl,
            sku: dto.sku ?? existing.sku,
            description: dto.description ?? existing.description,
            rawData: dto.rawData as Prisma.InputJsonValue ?? existing.rawData,
            extractedAt: new Date(),
          },
        });

        // Create price history entry
        await tx.priceHistory.create({
          data: {
            productId: existing.id,
            price,
            currency: dto.currency ?? 'USD',
          },
        });

        this.logger.log(`Updated product ${existing.id} with new price ${price}`);
        return updated;
      } else {
        // Create new product
        const created = await tx.product.create({
          data: {
            domainRuleId: dto.domainRuleId,
            title: dto.title ?? 'Unknown Product',
            price,
            currency: dto.currency ?? 'USD',
            imageUrl: dto.imageUrl,
            productUrl: dto.productUrl,
            sku: dto.sku,
            description: dto.description,
            rawData: dto.rawData as Prisma.InputJsonValue,
          },
        });

        // Create initial price history entry
        await tx.priceHistory.create({
          data: {
            productId: created.id,
            price,
            currency: dto.currency ?? 'USD',
          },
        });

        this.logger.log(`Created product ${created.id} with price ${price}`);
        return created;
      }
    });
  }

  async getPriceHistory(productId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { productId };

    if (from || to) {
      const capturedAt: Record<string, unknown> = {};
      if (from) capturedAt.gte = new Date(from);
      if (to) capturedAt.lte = new Date(to);
      where.capturedAt = capturedAt;
    }

    return this.prisma.priceHistory.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
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

  async ingestFromExtension(
    domain: string,
    pageUrl: string | undefined,
    products: Record<string, unknown>[],
  ) {
    let domainRule = await this.prisma.domainRule.findUnique({ where: { domain } });
    if (!domainRule) {
      domainRule = await this.prisma.domainRule.create({
        data: { domain, name: domain, selectorTitle: '', selectorPrice: '' },
      });
    }

    const results = [];
    for (const product of products) {
      try {
        // ── Dynamic field handling ──────────────────────────────────
        // Sin heurística de nombres — rawData guarda TODO tal cual.
        // La normalización se hace después, contra el schema final.
        const keys = Object.keys(product);

        // Title: first non-URL-ish string value
        let title = 'Raw product';
        for (const key of keys) {
          const v = String(product[key] ?? '').trim();
          if (v && v.length < 200 && !v.startsWith('http')) { title = v; break; }
        }

        let price = 0;
        for (const val of Object.values(product)) {
          if (typeof val === 'number' && val > 0) { price = val; break; }
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^\d+(\.\d+)?$/.test(trimmed)) {
              const n = parseFloat(trimmed);
              if (!isNaN(n) && n > 0) { price = n; break; }
            }
          }
        }

        const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
        const productUrl = `${pageUrl ?? domain}#${titleSlug}`;

        const existing = await this.prisma.product.findFirst({
          where: { productUrl, domainRuleId: domainRule.id },
        });

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: { title, price, currency: 'USD', rawData: product as any, extractedAt: new Date() },
          });
          await this.prisma.priceHistory.create({
            data: { productId: existing.id, price, currency: 'USD' },
          });
          results.push(existing);
        } else {
          const created = await this.prisma.product.create({
            data: { domainRuleId: domainRule.id, title, price, currency: 'USD', productUrl, rawData: product as any },
          });
          await this.prisma.priceHistory.create({
            data: { productId: created.id, price, currency: 'USD' },
          });
          results.push(created);
        }
      } catch (err) {
        this.logger.error(`Failed to ingest product: ${err}`);
      }
    }

    return { ingested: results.length, domainRuleId: domainRule.id };
  }

  async remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
