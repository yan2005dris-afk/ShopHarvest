import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { OfferResponseDto } from './offer-response.dto.js';

/**
 * Wire shape for `GET /products/:id` (and each entry of `GET /products`).
 *
 * Shrunk by `product-offer-split` to canonical fields only — price, url,
 * externalId, sku, and rawData moved to `OfferResponseDto` under
 * `offers[]`. `categoryId`/`brandId` are schema-only, unpopulated FK
 * columns (no auto-classification in this change).
 *
 * Whitelisting (unchanged from the original DTO):
 *   `@Expose()` on every property; the controller calls
 *   `plainToInstance(ProductResponseDto, row, { excludeExtraneousValues: true })`.
 */
export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Wireless Earbuds' })
  @Expose()
  title!: string;

  @ApiProperty({ required: false })
  @Expose()
  description?: string;

  @ApiProperty({ required: false, format: 'url' })
  @Expose()
  imageUrl?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Expose()
  categoryId?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Expose()
  brandId?: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;

  @ApiProperty({ type: [OfferResponseDto] })
  @Expose()
  @Type(() => OfferResponseDto)
  offers!: OfferResponseDto[];
}
