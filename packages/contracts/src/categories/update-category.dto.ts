import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FieldMappingDto } from '../domains/field-mapping.dto.js';

/**
 * Wire shape for `PATCH /categories/:id`. All fields are optional.
 */
export class UpdateCategoryDto {
  @ApiProperty({ required: false, maxLength: 60, example: 'Ropa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

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
