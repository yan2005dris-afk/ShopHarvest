import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FieldMappingDto } from './field-mapping.dto.js';

/**
 * Pagination strategy discriminator for a `DomainRule`.
 *
 *  - `'scroll'`      — sentinel-driven infinite scroll (default per
 *                       Prisma schema `paginationType @default("scroll")`).
 *  - `'page-number'` — traditional `?page=N` query string. Set by the
 *                       visual mapper when the user picks the "paged" tab.
 *
 * Exported as a named type alias so the frontend can type the same
 * value and any future `UpdateDomainDto.paginationType` field can reuse
 * it instead of duplicating the inline literal union.
 */
export type DomainPaginationType = 'scroll' | 'page-number';

/**
 * Wire shape for `GET /domains/:id` and `GET /domains`.
 *
 * Mirrors the Prisma `DomainRule` model: includes `paginationType` and
 * `paginationSelector` so the batch-5 auto-replay scheduler can read its
 * scroll configuration off the saved rule without a second roundtrip.
 *
 * `fieldMappings[]` is optional and is included whenever the persisted
 * rule has mappings configured (the common case), so the visual mapper
 * can rehydrate from a single GET. It may be omitted for legacy rules
 * created before Slice 2 or for rules auto-derived from extension payloads
 * without an explicit mapping session.
 */
export class DomainResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'temu.com' })
  @Expose()
  domain!: string;

  @ApiProperty({ example: 'Temu' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, example: '.product-card' })
  @Expose()
  containerSelector?: string;

  @ApiProperty({ required: false, minimum: 1, example: 50 })
  @Expose()
  productLimit?: number;

  @ApiProperty({ required: false, format: 'url' })
  @Expose()
  sampleUrl?: string;

  @ApiProperty({ required: false, format: 'date-time' })
  @Expose()
  lastScrapedAt?: string;

  /**
   * 'scroll'      — sentinel-driven infinite scroll (default per Prisma
   *                  schema `paginationType @default("scroll")`).
   * 'page-number' — traditional `?page=N` query string. Set by the
   *                  visual mapper when the user picks the "paged" tab.
   *
   * See `DomainPaginationType` for the named alias.
   */
  @ApiProperty({ enum: ['scroll', 'page-number'] })
  @Expose()
  paginationType!: DomainPaginationType;

  @ApiProperty({ required: false, example: 'button.load-more' })
  @Expose()
  paginationSelector?: string;

  @ApiProperty({ required: false, type: [FieldMappingDto] })
  @Expose()
  @Type(() => FieldMappingDto)
  fieldMappings?: FieldMappingDto[];

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;
}
