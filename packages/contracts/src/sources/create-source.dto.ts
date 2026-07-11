import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSourceDto {
  @ApiProperty({
    maxLength: 50,
    example: 'ML_AR',
    description: 'Unique source identifier code.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ maxLength: 120, example: 'Mercado Libre Argentina' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 'https://www.mercadolibre.com.ar',
    description: 'Base URL for the scraping source.',
  })
  @IsString()
  @IsNotEmpty()
  baseUrl!: string;

  @ApiProperty({
    required: false,
    type: Object,
    description: 'Source-specific extraction configuration.',
  })
  @IsOptional()
  config?: Record<string, unknown>;
}
