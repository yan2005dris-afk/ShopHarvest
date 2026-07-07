import {
  IsUUID,
  IsUrl,
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsObject,
} from 'class-validator';

/**
 * Wire shape for `POST /products/upsert`. Identifies a product by
 * (domainRuleId, productUrl) and overwrites its normalized fields plus
 * appending a new PriceHistory entry.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3.
 */
export class UpsertProductDto {
  @IsUUID()
  domainRuleId!: string;

  @IsUrl()
  productUrl!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  rawData?: Record<string, unknown>;
}