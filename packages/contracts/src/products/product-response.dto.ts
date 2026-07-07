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
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3.
 */
export class ProductResponseDto {
  @Expose()
  id!: string;

  @Expose()
  domainRuleId!: string;

  @Expose()
  externalId?: string;

  @Expose()
  title!: string;

  @Expose()
  @Type(() => Number)
  price!: number;

  @Expose()
  currency!: string;

  @Expose()
  imageUrl?: string;

  @Expose()
  productUrl!: string;

  @Expose()
  sku?: string;

  @Expose()
  description?: string;

  @Expose()
  rawData?: Record<string, unknown>;

  @Expose()
  extractedAt!: string;

  @Expose()
  createdAt!: string;

  @Expose()
  updatedAt!: string;
}
