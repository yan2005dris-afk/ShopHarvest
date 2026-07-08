import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsUrl,
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsObject,
  Length,
} from 'class-validator';

/**
 * Wire shape for `POST /products/upsert`. Identifies a product by
 * (domainRuleId, productUrl) and overwrites its normalized fields plus
 * appending a new PriceHistory entry.
 */
export class UpsertProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  domainRuleId!: string;

  @ApiProperty({ format: 'url' })
  @IsUrl()
  productUrl!: string;

  @ApiProperty({ example: 'Wireless Earbuds' })
  @IsString()
  title!: string;

  @ApiProperty({ required: false, type: Number, minimum: 0, example: 19.99 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiProperty({ required: false, example: 'USD', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ required: false, format: 'url' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ required: false, example: 'SKU-1234' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  rawData?: Record<string, unknown>;
}
