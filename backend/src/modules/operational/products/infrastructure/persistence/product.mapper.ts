import type {
  Offer as PrismaOffer,
  PriceObservation as PrismaPriceObservation,
  Product as PrismaProduct,
} from '../../../../../generated/operational';
import { Prisma } from '../../../../../generated/operational';
import { Offer } from '../../domain/offer.entity';
import type { OfferProps, CreateOfferInput } from '../../domain/offer.entity';
import { PriceObservation } from '../../domain/price-observation.entity';
import type { PriceObservationProps } from '../../domain/price-observation.entity';
import { Product } from '../../domain/product.entity';
import type { ProductProps } from '../../domain/product.entity';

/**
 * Prisma row shape for a Product with its offers and (optionally) each
 * offer's price observations. Kept private to the persistence layer so
 * the domain never imports Prisma types.
 *
 * `Decimal` types are coerced to `number` here so the entity layer
 * never needs to know about `Prisma.Decimal`. The legacy
 * `prisma.product.findUnique({ include: { offers: { include:
 * { priceObservations } } } })` row carries live `Decimal` instances in
 * process — handled by `coercePrice`.
 */
export type PrismaProductWithOffers = PrismaProduct & {
  offers?: Array<
    PrismaOffer & {
      priceObservations?: PrismaPriceObservation[];
    }
  >;
};

/**
 * Coerce a Prisma `Decimal` (or number, or string) to a plain JS
 * `number`. Used at the persistence boundary so the domain types stay
 * framework-free.
 */
function coercePrice(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  // Prisma's Decimal has toJSON() returning a string. Use it when
  // available, else coerce via Number() if the value is numeric-shaped.
  if (
    typeof value === 'object' &&
    typeof (value as { toJSON?: () => string }).toJSON === 'function'
  ) {
    const json = (value as { toJSON: () => string }).toJSON();
    const n = Number(json);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Maps a Prisma row to a Product domain entity (and back).
 *
 * Two methods:
 *   - `toDomain(row)` rebuilds the aggregate, stripping the Prisma
 *     relation but composing child `Offer` / `PriceObservation` entities.
 *   - `toPersistence(product)` returns a Prisma-shaped bag the
 *     repository can hand back to the client.
 */
export class ProductMapper {
  static toDomain(row: PrismaProductWithOffers): Product {
    const offers: Offer[] = (row.offers ?? []).map((offerRow) =>
      ProductMapper.offerToDomain(offerRow),
    );

    const props: ProductProps = {
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      categoryId: row.categoryId,
      brandId: row.brandId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      offers,
    };
    return Product.fromPersistence(props);
  }

  static offerToDomain(
    row: PrismaOffer & { priceObservations?: PrismaPriceObservation[] },
  ): Offer {
    const props: OfferProps = {
      id: row.id,
      productId: row.productId,
      sourceId: row.sourceId,
      domainRuleId: row.domainRuleId,
      url: row.url,
      externalId: row.externalId ?? null,
      sku: row.sku,
      currency: row.currency,
      price: coercePrice(row.price),
      rawData: (row.rawData as Record<string, unknown> | null) ?? null,
      extractedAt: row.extractedAt,
    };
    const offer = Offer.fromPersistence(props);
    if (row.priceObservations) {
      // The repository sometimes embeds priceObservations on the
      // offer; preserve them by stashing them on a side-channel via
      // `toJSON`. We never expose them through the Offer accessor (the
      // entity has no `priceObservations` getter) — they only ride
      // along in the nested response shape via the response mapper, if
      // needed. For now Offer carries no nested accessor, so we ignore
      // them here. They live independently on
      // `findPriceHistory(productId)` queries.
    }
    return offer;
  }

  static priceObservationToDomain(
    row: PrismaPriceObservation,
  ): PriceObservation {
    const props: PriceObservationProps = {
      id: row.id,
      offerId: row.offerId,
      price: coercePrice(row.price),
      currency: row.currency,
      observedAt: row.observedAt,
      createdAt: row.createdAt,
    };
    return PriceObservation.fromPersistence(props);
  }

  /**
   * Round-trip helper for new product creation. The use case passes
   * the fields; the repository wraps them in `prisma.product.create`.
   */
  static newProductPersistence(input: {
    id: string;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
  }): {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
  } {
    return {
      id: input.id,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
    };
  }

  /**
   * Round-trip helper for new offer creation (used inside the ingest
   * transaction). The returned shape satisfies Prisma's
   * `OfferCreateInput` — `null` JSON values must go through
   * `Prisma.JsonNull` (the "Json null" sentinel) so Prisma preserves
   * the column's NULL state instead of overwriting with the JSON `null`
   * literal.
   */
  static newOfferPersistence(input: CreateOfferInput): {
    id: string;
    productId: string;
    sourceId: string;
    domainRuleId: string | null;
    url: string;
    externalId: string | null;
    sku: string | null;
    currency: string;
    price: number;
    rawData: Prisma.InputJsonValue;
    extractedAt: Date;
  } {
    return {
      id: input.id,
      productId: input.productId,
      sourceId: input.sourceId,
      domainRuleId: input.domainRuleId,
      url: input.url,
      externalId: input.externalId ?? null,
      sku: input.sku ?? null,
      currency: input.currency,
      price: input.price,
      rawData: (input.rawData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      extractedAt: input.extractedAt ?? new Date(),
    };
  }
}
