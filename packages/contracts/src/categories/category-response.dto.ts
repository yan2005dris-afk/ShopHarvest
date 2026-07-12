import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FieldMappingDto } from '../domains/field-mapping.dto.js';

/**
 * Wire shape for `GET /categories/:id` and `GET /categories`.
 *
 * Mirrors the Prisma `Category` model. `parentId` is included for tree
 * hierarchy (legacy from Fase1a product categories).
 */
export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Ropa' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, example: 'Productos de vestir y accesorios.' })
  @Expose()
  description?: string;

  @ApiProperty({ required: false, type: [FieldMappingDto] })
  @Expose()
  @Type(() => FieldMappingDto)
  defaultFieldMappings?: FieldMappingDto[];

  @ApiProperty({ required: false, example: 'parent-uuid' })
  @Expose()
  parentId?: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;
}
