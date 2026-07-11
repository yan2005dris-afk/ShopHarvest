import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'ML_AR' })
  @Expose()
  code!: string;

  @ApiProperty({ example: 'Mercado Libre Argentina' })
  @Expose()
  name!: string;

  @ApiProperty({ example: 'https://www.mercadolibre.com.ar' })
  @Expose()
  baseUrl!: string;

  @ApiProperty({ enum: ['inactive', 'active', 'error'], example: 'inactive' })
  @Expose()
  status!: string;

  @ApiProperty({ required: false, type: Object })
  @Expose()
  config?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;
}
