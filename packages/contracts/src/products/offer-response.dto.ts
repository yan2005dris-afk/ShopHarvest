import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Wire shape for an `Offer` (product-at-a-site listing) nested inside
 * `ProductResponseDto.offers[]`, and returned as the ingest-response entry.
 *
 * Introduced by `product-offer-split`: price/url/externalId moved off the
 * flat `Product` onto `Offer` (design.md §"Data Model").
 *
 * Decimal → number fix (same as the original `ProductResponseDto`):
 *   Prisma serializes `@db.Decimal(12, 2)` as a JSON string ('19.99').
 *   `@Type(() => Number)` coerces it back to a real `number`.
 */
export class OfferResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  sourceId!: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Expose()
  domainRuleId?: string;

  @ApiProperty({ required: false })
  @Expose()
  externalId?: string;

  @ApiProperty({ format: 'url' })
  @Expose()
  url!: string;

  @ApiProperty({ required: false })
  @Expose()
  sku?: string;

  @ApiProperty({ type: Number, example: 19.99 })
  @Expose()
  @Type(() => Number)
  price!: number;

  @ApiProperty({ example: 'USD' })
  @Expose()
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  extractedAt!: string;
}
