import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ProductResponseDto } from './product-response.dto.js';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current 1-based page number' })
  page!: number;

  @ApiProperty({ example: 24, description: 'Page size limit' })
  limit!: number;

  @ApiProperty({ example: 60, description: 'Total matching items across all pages' })
  total!: number;

  @ApiProperty({ example: 3, description: 'Total available pages' })
  totalPages!: number;
}

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto], description: 'Page items' })
  @ValidateNested({ each: true })
  @Type(() => ProductResponseDto)
  data!: ProductResponseDto[];

  @ApiProperty({ type: PaginationMetaDto, description: 'Pagination metadata' })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto;
}
