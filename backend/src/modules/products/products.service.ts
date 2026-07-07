import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  UpsertProductDto,
  IngestProductsDto,
} from '@web-scraping/contracts/products';
import type { FieldMappingDto } from '@web-scraping/contracts/domains';

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
            rawData: (dto.rawData as Prisma.InputJsonValue) ?? existing.rawData,
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

        this.logger.log(
          `Updated product ${existing.id} with new price ${price}`,
        );
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

  async ingestFromExtension(dto: IngestProductsDto) {
    let domainRule = await this.prisma.domainRule.findUnique({
      where: { domain: dto.domain },
    });

    const incomingMappings =
      dto.fieldMappings && dto.fieldMappings.length > 0
        ? dto.fieldMappings
        : null;

    if (!domainRule) {
      // First time we see this domain: create a rule from the inbound
      // mappings (preferred) or, as a degraded fallback, derive from
      // payload keys.
      const fieldMappings =
        incomingMappings ?? this.deriveFieldMappingsFromPayload(dto.products);

      domainRule = await this.prisma.domainRule.create({
        data: {
          domain: dto.domain,
          name: dto.domain,
          fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      // Rule already exists. Backfill its `fieldMappings` only when the
      // stored rule has none yet (legacy install or auto-create from a
      // previous ingest without mappings). We do NOT overwrite UI-edited
      // mappings (PATCH /domains/:id) on every ingest — that would
      // clobber user customizations. If the extension genuinely changed
      // the rule, PATCH it explicitly.
      const storedMappings = (domainRule.fieldMappings ??
        []) as unknown as FieldMappingDto[];
      if (
        storedMappings.length === 0 &&
        incomingMappings &&
        incomingMappings.length > 0
      ) {
        domainRule = await this.prisma.domainRule.update({
          where: { id: domainRule.id },
          data: {
            fieldMappings: incomingMappings as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    const mappings =
      (domainRule.fieldMappings as unknown as FieldMappingDto[]) ?? [];

    // Hoist the "no title mapping" warning so a 500-product ingest does
    // not log 500 lines.
    const hasTitleMapping = mappings.some((m) =>
      /^title$|^nombre$|^name$/i.test(m.canonicalField),
    );
    if (!hasTitleMapping) {
      this.logger.warn(
        `Ingest for "${dto.domain}" has no canonical title mapping (title/nombre/name); products will fall back to "Raw product"`,
      );
    }

    const results = [];

    for (let index = 0; index < dto.products.length; index++) {
      const product = dto.products[index];
      try {
        const mapped = this.mapProductByRule(product, mappings);
        const titleSlug = mapped.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 80);
        // Disambiguate duplicates: productUrl is the dedup key against
        // (productUrl, domainRuleId), so two items with identical titles
        // would otherwise collide and the second silently overwrites the
        // first. Append the batch index as a stable suffix. If sku is
        // present it stays the same across runs so re-ingest still upserts.
        const productUrl = `${dto.pageUrl ?? dto.domain}#${titleSlug}-${index}`;

        const existing = await this.prisma.product.findFirst({
          where: { productUrl, domainRuleId: domainRule.id },
        });

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              title: mapped.title,
              price: mapped.price,
              currency: 'USD',
              imageUrl: mapped.imageUrl ?? undefined,
              sku: mapped.sku ?? undefined,
              description: mapped.description ?? undefined,
              rawData: product,
              extractedAt: new Date(),
            },
          });
          await this.prisma.priceHistory.create({
            data: {
              productId: existing.id,
              price: mapped.price,
              currency: 'USD',
            },
          });
          results.push(existing);
        } else {
          const created = await this.prisma.product.create({
            data: {
              domainRuleId: domainRule.id,
              title: mapped.title,
              price: mapped.price,
              currency: 'USD',
              imageUrl: mapped.imageUrl ?? undefined,
              productUrl,
              sku: mapped.sku ?? undefined,
              description: mapped.description ?? undefined,
              rawData: product,
            },
          });
          await this.prisma.priceHistory.create({
            data: {
              productId: created.id,
              price: mapped.price,
              currency: 'USD',
            },
          });
          results.push(created);
        }
      } catch (err) {
        this.logger.error(`Failed to ingest product: ${err}`);
      }
    }

    return { ingested: results.length, domainRuleId: domainRule.id };
  }

  /**
   * Map an inbound product to normalized fields using the rule's
   * `fieldMappings`. The extension is the source of truth for which
   * canonical field a key represents; this function only translates.
   *
   * No guessing, no scanning. If a mapping is missing for a given role,
   * the corresponding field is `undefined` (except title/price which
   * have safe fallbacks + a warning log).
   */
  private mapProductByRule(
    product: Record<string, unknown>,
    mappings: FieldMappingDto[],
  ): {
    title: string;
    price: number;
    imageUrl?: string;
    sku?: string;
    description?: string;
  } {
    const valueFor = (canonicalRegex: RegExp): unknown => {
      const mapping = mappings.find((m) =>
        canonicalRegex.test(m.canonicalField),
      );
      if (!mapping) return undefined;
      return product[mapping.canonicalField];
    };

    // ── Title ──────────────────────────────────────────────────────────
    // No guessing: only the canonical mapping wins. If none matches,
    // use the placeholder; the warning has already been hoisted to
    // the parent ingest call so we don't spam logs.
    let title = 'Raw product';
    const titleMapping = mappings.find((m) =>
      /^title$|^nombre$|^name$/i.test(m.canonicalField),
    );
    if (titleMapping) {
      const raw = product[titleMapping.canonicalField];
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      if (trimmed) title = trimmed;
    }

    // ── Price ─────────────────────────────────────────────────────
    let price = 0;
    const priceMapping = mappings.find((m) =>
      /^price$|^precio$|^amount$/i.test(m.canonicalField),
    );
    if (priceMapping) {
      const raw = product[priceMapping.canonicalField];
      if (typeof raw === 'number' && raw >= 0) {
        price = raw;
      } else if (typeof raw === 'string') {
        const parsed = parseFloat(raw.trim());
        if (!isNaN(parsed) && parsed >= 0) price = parsed;
      }
    }

    // ── Image / SKU / Description ─────────────────────────────────
    const asString = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined;

    const imageUrl = asString(valueFor(/^image$|^img$|^foto$|^picture$/i));
    const sku = asString(valueFor(/^sku$/i));
    const description = asString(valueFor(/^desc/i));

    return { title, price, imageUrl, sku, description };
  }

  /**
   * Build a minimal FieldMapping[] from the keys of the first product.
   * Used only as a fallback when the extension sends a payload without
   * `fieldMappings` (deprecated path). Selectors are empty; the next
   * mapping session in the extension UI should overwrite them.
   */
  private deriveFieldMappingsFromPayload(
    products: Array<Record<string, unknown>>,
  ): FieldMappingDto[] {
    if (products.length === 0) return [];
    const keys = Object.keys(products[0]);
    return keys.map((key) => ({
      canonicalField: key,
      selector: '',
      type: 'text' as const,
    }));
  }

  async remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
