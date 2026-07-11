import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class BrandResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Samsung' })
  @Expose()
  name!: string;

  @ApiProperty({ example: ['Sam', 'SSG'] })
  @Expose()
  aliases!: string[];

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  updatedAt!: string;
}
