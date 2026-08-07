import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, MinLength, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Wire shape for the `GET /products` query string.
 */
export class ProductQueryDto {
  @ApiProperty({
    required: false,
    type: Number,
    description: '1-based page index. Defaults to 1.',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    type: Number,
    description: 'Page size limit (1..100). Defaults to 24.',
    default: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;

  @ApiProperty({
    required: false,
    type: String,
    description: 'Search term for product title (diacritic and case insensitive, minimum 2 characters when trimmed).',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  q?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  domainRuleId?: string;
}
