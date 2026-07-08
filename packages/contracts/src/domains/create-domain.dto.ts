import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { FieldMappingDto } from './field-mapping.dto.js';

/** Lowercase the incoming domain so "Temu.COM" and "temu.com" collapse. */
const lowercaseDomain = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toLowerCase() : value;

/**
 * Wire shape for `POST /domains`.
 *
 * `fieldMappings` is REQUIRED and is the single source of truth for how
 * scraped fields map to canonical roles (title, price, etc.). Legacy
 * `selectorTitle/Price/Image/Sku` are intentionally NOT accepted — they
 * were redundant and inconsistent with the visual mapper.
 */
export class CreateDomainDto {
  @ApiProperty({
    maxLength: 253,
    example: 'temu.com',
    description: 'Hostname (lowercased on save).',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(lowercaseDomain)
  @MaxLength(253)
  @Matches(/^[a-z0-9.\-:]+$/i, {
    message:
      'domain must be a hostname-like string (letters, digits, dots, hyphens, colons)',
  })
  domain!: string;

  @ApiProperty({ maxLength: 120, example: 'Temu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: [FieldMappingDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'fieldMappings must contain at least one mapping' })
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fieldMappings!: FieldMappingDto[];

  @ApiProperty({
    required: false,
    maxLength: 2000,
    example: '.product-card',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  containerSelector?: string;

  @ApiProperty({ required: false, minimum: 1, example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  productLimit?: number;

  @ApiProperty({
    required: false,
    format: 'url',
    example: 'https://www.temu.com/category-1.html',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_valid_protocol: true })
  sampleUrl?: string;
}
