import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FieldMappingDto } from '../domains/field-mapping.dto.js';

/**
 * Wire shape for `POST /categories`.
 *
 * `description` explains the category's purpose (e.g. "Productos de vestir
 * y accesorios" for Ropa). `defaultFieldMappings` defines the fields that
 * scraped products under this category should map to (image, title, price, etc.).
 */
export class CreateCategoryDto {
  @ApiProperty({ maxLength: 60, example: 'Ropa', description: 'Category name (unique).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'Productos de vestir y accesorios.',
    description: 'Description of the category.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    required: false,
    example: 'parent-uuid',
    description: 'Optional parent category for tree hierarchy.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({
    required: false,
    type: [FieldMappingDto],
    description: 'Default field mappings that apply to all domains under this category.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  defaultFieldMappings?: FieldMappingDto[];
}
