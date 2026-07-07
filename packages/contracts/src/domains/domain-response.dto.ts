import { Expose, Type } from 'class-transformer';
import { FieldMappingDto } from './field-mapping.dto.js';

/**
 * Wire shape for `GET /domains/:id` and `GET /domains`.
 *
 * Mirrors the Prisma `DomainRule` model: includes `paginationType` and
 * `paginationSelector` so the batch-5 auto-replay scheduler can read its
 * scroll configuration off the saved rule without a second roundtrip.
 *
 * Includes the full `fieldMappings[]` payload so the visual mapper can
 * rehydrate from a single GET.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3. @Expose + @Type control
 * class-transformer serialization (used by NestJS' built-in
 * ClassSerializerInterceptor when consuming controllers wire it up).
 */
export class DomainResponseDto {
  @Expose()
  id!: string;

  @Expose()
  domain!: string;

  @Expose()
  name!: string;

  @Expose()
  containerSelector?: string;

  @Expose()
  productLimit?: number;

  @Expose()
  sampleUrl?: string;

  @Expose()
  lastScrapedAt?: string;

  /**
   * 'scroll'      — sentinel-driven infinite scroll (default per Prisma
   *                  schema `paginationType @default("scroll")`).
   * 'page-number' — traditional `?page=N` query string. Set by the
   *                  visual mapper when the user picks the "paged" tab.
   */
  @Expose()
  paginationType!: 'scroll' | 'page-number';

  @Expose()
  paginationSelector?: string;

  @Expose()
  @Type(() => FieldMappingDto)
  fieldMappings?: FieldMappingDto[];

  @Expose()
  createdAt!: string;

  @Expose()
  updatedAt!: string;
}