import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
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
 * Wire shape for `PATCH /domains/:id`. All fields are optional. We hand-roll
 * this instead of using `PartialType` because `@nestjs/mapped-types` is not
 * installed in this workspace.
 */
export class UpdateDomainDto {
  @ApiProperty({ required: false, maxLength: 253, example: 'temu.com' })
  @IsOptional()
  @IsString()
  @Transform(lowercaseDomain)
  @MaxLength(253)
  @Matches(/^[a-z0-9.\-:]+$/i, {
    message:
      'domain must be a hostname-like string (letters, digits, dots, hyphens, colons)',
  })
  domain?: string;

  @ApiProperty({ required: false, maxLength: 120, example: 'Temu' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Category UUID for organizing this domain.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, type: [FieldMappingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fieldMappings?: FieldMappingDto[];

  @ApiProperty({ required: false, maxLength: 2000, example: '.product-card' })
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
