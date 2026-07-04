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
import { Type } from 'class-transformer';
import { FieldMappingDto } from './field-mapping.dto';

/**
 * Wire shape for `POST /domains`.
 *
 * `fieldMappings` is REQUIRED and is the single source of truth for how
 * scraped fields map to canonical roles (title, price, etc.). Legacy
 * `selectorTitle/Price/Image/Sku` are intentionally NOT accepted — they
 * were redundant and inconsistent with the visual mapper.
 */
export class CreateDomainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @Matches(/^[a-z0-9.\-:]+$/i, {
    message:
      'domain must be a hostname-like string (letters, digits, dots, hyphens, colons)',
  })
  domain!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'fieldMappings must contain at least one mapping' })
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fieldMappings!: FieldMappingDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  containerSelector?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productLimit?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true, require_valid_protocol: true })
  sampleUrl?: string;
}
