import { Expose, Type } from 'class-transformer';

/**
 * Wire shape for `GET /products/:id/history` entries.
 *
 * Same Decimal → number fix as ProductResponseDto:
 *   `@Type(() => Number)` coerces the JSON-stringified Prisma Decimal
 *   back to a real `number` so the frontend can chart the series
 *   without parsing every entry by hand.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3.
 */
export class PriceHistoryResponseDto {
  @Expose()
  id!: string;

  @Expose()
  productId!: string;

  @Expose()
  @Type(() => Number)
  price!: number;

  @Expose()
  currency!: string;

  @Expose()
  capturedAt!: string;

  @Expose()
  createdAt!: string;
}