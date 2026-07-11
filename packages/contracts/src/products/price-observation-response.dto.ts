import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Wire shape for `GET /products/:id/history` entries — replaces
 * `PriceHistoryResponseDto`. Hangs off `Offer` via `offerId` (not
 * `Product` directly), per `product-offer-split`.
 *
 * Same Decimal → number fix as `OfferResponseDto`.
 */
export class PriceObservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  offerId!: string;

  @ApiProperty({ type: Number, example: 19.99 })
  @Expose()
  @Type(() => Number)
  price!: number;

  @ApiProperty({ example: 'USD' })
  @Expose()
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  observedAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;
}
