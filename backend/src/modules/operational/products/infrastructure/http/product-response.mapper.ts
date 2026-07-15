import type {
  OfferResponseDto,
  PriceObservationResponseDto,
  ProductResponseDto,
} from '@web-scraping/contracts/products';
import type { Offer } from '../../domain/offer.entity';
import type { PriceObservation } from '../../domain/price-observation.entity';
import type { Product } from '../../domain/product.entity';

/**
 * Entity → HTTP DTO mapping.
 *
 * Mirrors the legacy `plainToInstance(ProductResponseDto, row, {
 * excludeExtraneousValues: true })` shape so the wire contract is
 * unchanged:
 *
 *   - `@Expose()` whitelist on the contract DTOs removes anything not
 *     in this mapper (no Prisma `rawData`, no joined `offer` relation
 *     leaking).
 *   - `@Type(() => Number)` on `price` was the Decimal→JS-number fix on
 *     the legacy code path. We pre-coerce Decimals at the persistence
 *     boundary (ProductMapper.coercePrice), so the entity already
 *     holds a real `number`; the mapper just assigns it.
 *   - `null` → `undefined` for optional fields, matching the wire shape
 *     produced by `class-transformer` when `excludeExtraneousValues`
 *     strips unexposed fields.
 *
 * Returns plain objects — NestJS's serialization pipeline (validation
 * pipe + global filter) does not require DTO class instances, and the
 * fields kept here line up exactly with the `@Expose()` ones on the
 * contract.
 */
export class ProductResponseMapper {
  static toDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      title: product.title,
      description: product.description ?? undefined,
      imageUrl: product.imageUrl ?? undefined,
      categoryId: product.categoryId ?? undefined,
      brandId: product.brandId ?? undefined,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      offers: product.offers.map((offer) =>
        ProductResponseMapper.offerToDto(offer),
      ),
    };
  }

  static offerToDto(offer: Offer): OfferResponseDto {
    return {
      id: offer.id,
      productId: offer.productId,
      sourceId: offer.sourceId,
      domainRuleId: offer.domainRuleId ?? undefined,
      externalId: offer.externalId ?? undefined,
      url: offer.url,
      sku: offer.sku ?? undefined,
      price: offer.price,
      currency: offer.currency,
      extractedAt: offer.extractedAt.toISOString(),
    };
  }

  static priceObservationToDto(
    obs: PriceObservation,
  ): PriceObservationResponseDto {
    return {
      id: obs.id,
      offerId: obs.offerId,
      price: obs.price,
      currency: obs.currency,
      observedAt: obs.observedAt.toISOString(),
      createdAt: obs.createdAt.toISOString(),
    };
  }
}
