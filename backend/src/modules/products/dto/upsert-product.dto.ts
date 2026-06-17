import {
  IsUUID,
  IsUrl,
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsObject,
} from 'class-validator';

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
