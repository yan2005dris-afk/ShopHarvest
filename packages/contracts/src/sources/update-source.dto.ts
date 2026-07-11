import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSourceDto {
  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiProperty({
    required: false,
    enum: ['inactive', 'active', 'error'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  config?: Record<string, unknown>;
}
