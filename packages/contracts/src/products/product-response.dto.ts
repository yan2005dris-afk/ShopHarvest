import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Wire shape for `GET /products/:id` (and the per-entry fields returned by
 * `GET /products`).
 *
 * Decimal → number fix (Spec 2 REQ-DT-1):
 *   Prisma serializes `@db.Decimal(12, 2)` as a JSON string ('19.99').
 *   `@Type(() => Number)` instructs class-transformer to coerce that
 *   string back to a real `number` during `plainToInstance(...)`. This
 *   is the core Spec 2 fix — without it, the Angular `Product.price`
 *   is `string`, and arithmetic / template formatting silently breaks.
 *
 * Date fields:
 *   Prisma emits DateTime as ISO 8601 strings; we keep them as `string`
 *   for stable JSON wire format (frontend already parses ISO via the
 *   `Date` constructor).
 *
 * Whitelisting (REQ-DT-3):
 *   `@Expose()` on every property. `forbidNonWhitelisted` in main.ts
 *   already strips non-decorated fields from request DTOs; here the
 *   whitelist controls response serialization when the controller calls
 *   `plainToInstance(ProductResponseDto, row)` with
 *   `{ excludeExtraneousValues: true }`.
 */
export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  domainRuleId!: string;

  @ApiProperty({ required: false })
  @Expose()
  externalId?: string;

  @ApiProperty({ example: 'Wireless Earbuds' })
  @Expose()
  title!: string;

  @ApiProperty({ type: Number, example: 19.99 })
  @Expose()
  @Type(() => Number)
  price!: number;

  @ApiProperty({ example: 'USD' })
  @Expose()
  currency!: string;

  @ApiProperty({ required: false, format: 'url' })
  @Expose()
  imageUrl?: string;

  @ApiProperty({ format: 'url' })
  @Expose()
  productUrl!: string;

  @ApiProperty({ required: false })
  @Expose()
  sku?: string;

  @ApiProperty({ required: false })
  @Expose()
  description?: string;

  @ApiProperty({ required: false, type: Object })
  @Expose()
  rawData?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  extractedAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;
}
