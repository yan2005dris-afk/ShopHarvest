import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Wire shape for `GET /products/:id/history` entries.
 *
 * Same Decimal → number fix as ProductResponseDto:
 *   `@Type(() => Number)` coerces the JSON-stringified Prisma Decimal
 *   back to a real `number` so the frontend can chart the series
 *   without parsing every entry by hand.
 */
export class PriceHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  productId!: string;

  @ApiProperty({ type: Number, example: 19.99 })
  @Expose()
  @Type(() => Number)
  price!: number;

  @ApiProperty({ example: 'USD' })
  @Expose()
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  capturedAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;
}
