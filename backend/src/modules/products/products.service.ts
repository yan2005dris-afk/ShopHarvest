import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RawCaptureStatus } from '../../generated/operational';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';
import type { IngestProductsDto } from '@web-scraping/contracts/products';
import type { FieldMappingDto } from '@web-scraping/contracts/domains';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(includeHistory = true) {
    return this.prisma.product.findMany({
      include: {
        offers: {
          include: { priceObservations: includeHistory },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * `domainRuleId` now lives on `Offer`, not `Product` (product-offer-split).
   * Returns every `Product` that has at least one `Offer` scoped to that
   * rule, with only the matching offer(s) nested in the response.
   */
  async findAllByDomain(domainRuleId: string) {
    return this.prisma.product.findMany({
      where: { offers: { some: { domainRuleId } } },
      include: {
        offers: {
          where: { domainRuleId },
          include: { priceObservations: true },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        offers: { include: { priceObservations: true } },
      },
    });
  }

  /**
   * Price history across all of a product's `Offer`(s) — spec's "Price
   * History Retrieval Across Offers" requirement. Each entry still carries
   * its own `offerId`, so a multi-offer product's series stays attributable
   * per-offer instead of merging into one undifferentiated series.
   */
  async getPriceHistory(productId: string, from?: string, to?: string) {
    const where: Prisma.PriceObservationWhereInput = {
      offer: { productId },
    };

    if (from || to) {
      where.observedAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    return this.prisma.priceObservation.findMany({
      where,
      orderBy: { observedAt: 'desc' },
    });
  }

  /**
   * Ingest a batch of extension-extracted products.
   *
   * Rewritten by `product-offer-split` (design.md "Data Flow (ingest)") to
   * write the canonical Product + Offer + PriceObservation + RawCapture
   * shape, all inside one `$transaction`:
   *
   *   upsert Source (code=domain) → backfill DomainRule.sourceId →
   *   upsert Product+Offer (keyed by (sourceId, url), no cross-source
   *   dedup — 1 ingested item = 1 Offer) → create PriceObservation →
   *   tx.rawCapture.upsert (real FK to Offer).
   *
   * Written inline (not via `RawCapturesService`, which holds a separate
   * Prisma connection and would break the transaction's atomicity).
   */
  async ingestFromExtension(dto: IngestProductsDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve/create the Source the extension is scraping (Decision 1,
      // design.md) — the extension only ever sends `dto.domain`.
      let source = await tx.source.findUnique({
        where: { code: dto.domain },
      });
      if (!source) {
        source = await tx.source.create({
          data: {
            code: dto.domain,
            name: dto.domain,
            baseUrl: `https://${dto.domain}`,
          },
        });
      }

      // 2. Resolve/create the DomainRule for this domain and backfill its
      // sourceId bridge when missing (legacy rows have none).
      let domainRule = await tx.domainRule.findUnique({
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

        domainRule = await tx.domainRule.create({
          data: {
            domain: dto.domain,
            name: dto.domain,
            categoryId: dto.categoryId ?? null,
            fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
            sourceId: source.id,
          },
        });
      } else {
        // Rule already exists. Backfill its `fieldMappings` only when the
        // stored rule has none yet (legacy install or auto-create from a
        // previous ingest without mappings) — do NOT overwrite UI-edited
        // mappings on every ingest. Also backfill `sourceId` when the rule
        // predates the Source bridge (product-offer-split).
        const storedMappings = (domainRule.fieldMappings ??
          []) as unknown as FieldMappingDto[];
        const needsMappingsBackfill =
          storedMappings.length === 0 &&
          incomingMappings !== null &&
          incomingMappings.length > 0;
        const needsSourceBackfill = domainRule.sourceId == null;
        const needsCategoryBackfill =
          dto.categoryId != null && domainRule.categoryId == null;

        if (needsMappingsBackfill || needsSourceBackfill || needsCategoryBackfill) {
          domainRule = await tx.domainRule.update({
            where: { id: domainRule.id },
            data: {
              ...(needsMappingsBackfill && {
                fieldMappings:
                  incomingMappings as unknown as Prisma.InputJsonValue,
              }),
              ...(needsSourceBackfill && { sourceId: source.id }),
              ...(needsCategoryBackfill && { categoryId: dto.categoryId }),
            },
          });
        }
      }

      // The extension is authoritative for field mappings — use incoming
      // mappings when provided, falling back to the stored rule.
      const mappings =
        incomingMappings ??
        ((domainRule.fieldMappings as unknown as FieldMappingDto[]) ?? []);

      // Hoist the "no title mapping" warning so a 500-product ingest does
      // not log 500 lines.
      const hasTitleMapping = mappings.some((m) =>
        /^title$|^nombre$|^name$|^titulo$/i.test(m.canonicalField),
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
          // Disambiguate duplicates: `url` is the dedup key against
          // (sourceId, url) on Offer, so two items with identical titles
          // would otherwise collide and the second silently overwrites the
          // first. Append the batch index as a stable suffix.
          const url = `${dto.pageUrl ?? dto.domain}#${titleSlug}-${index}`;

          const existingOffer = await tx.offer.findUnique({
            where: { sourceId_url: { sourceId: source.id, url } },
          });

          let offer;
          if (existingOffer) {
            // Re-ingest of the same (sourceId, url) pair: update the
            // existing Offer + its canonical Product, do NOT create a
            // duplicate (spec: "Re-ingesting the same pair updates, not
            // duplicates").
            offer = await tx.offer.update({
              where: { id: existingOffer.id },
              data: {
                price: mapped.price,
                currency: 'USD',
                sku: mapped.sku ?? undefined,
                rawData: product,
                extractedAt: new Date(),
              },
            });
            await tx.product.update({
              where: { id: existingOffer.productId },
              data: {
                title: mapped.title,
                imageUrl: mapped.imageUrl ?? undefined,
                description: mapped.description ?? undefined,
              },
            });
          } else {
            // New (sourceId, url) pair: create a new Product and a new
            // Offer — no cross-source/cross-item dedup (spec: "One Offer
            // Per Ingested Item").
            const createdProduct = await tx.product.create({
              data: {
                title: mapped.title,
                imageUrl: mapped.imageUrl,
                description: mapped.description,
              },
            });
            offer = await tx.offer.create({
              data: {
                productId: createdProduct.id,
                sourceId: source.id,
                domainRuleId: domainRule.id,
                url,
                sku: mapped.sku,
                currency: 'USD',
                price: mapped.price,
                rawData: product,
              },
            });
          }

          await tx.priceObservation.create({
            data: {
              offerId: offer.id,
              price: mapped.price,
              currency: 'USD',
            },
          });

          // RawCapture — real FK to Offer (design.md Decision 2). Written
          // inline via the same `tx`, not `RawCapturesService` (separate
          // connection, would break atomicity).
          await tx.rawCapture.upsert({
            where: {
              offerId_sourceId: { offerId: offer.id, sourceId: source.id },
            },
            create: {
              offerId: offer.id,
              sourceId: source.id,
              payload: product as Prisma.InputJsonValue,
              status: RawCaptureStatus.UNPROCESSED,
              attempts: 0,
            },
            update: {
              payload: product as Prisma.InputJsonValue,
              capturedAt: new Date(),
              status: RawCaptureStatus.UNPROCESSED,
              attempts: 0,
            },
          });

          results.push(offer);
        } catch (err) {
          this.logger.error(`Failed to ingest product: ${err}`);
        }
      }

      return { ingested: results.length, domainRuleId: domainRule.id };
    });
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
      /^title$|^nombre$|^name$|^titulo$/i.test(m.canonicalField),
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

    const imageUrl = asString(valueFor(/^image$|^img$|^foto$|^picture$|^imagen$/i));
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
