import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { BrandResponseDto } from './brand-response.dto.js';

export class FuzzyMatchResultDto {
  @ApiProperty({ type: BrandResponseDto, nullable: true })
  @Expose()
  @Type(() => BrandResponseDto)
  brand!: BrandResponseDto | null;

  @ApiProperty({ type: Number, example: 0.75 })
  @Expose()
  similarity!: number;

  @ApiProperty({ description: 'True when 0.6 < similarity < 0.75' })
  @Expose()
  lowConfidence!: boolean;
}
