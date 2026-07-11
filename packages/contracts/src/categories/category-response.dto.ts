import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Celulares y Teléfonos' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Expose()
  parentId?: string;

  @ApiProperty({ example: '/c1/c5', description: 'Materialized ancestor path.' })
  @Expose()
  path!: string;

  @ApiProperty({ required: false, type: [CategoryResponseDto] })
  @Expose()
  @Type(() => CategoryResponseDto)
  children?: CategoryResponseDto[];

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;
}
