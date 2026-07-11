import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 120, example: 'Celulares y Teléfonos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ required: false, format: 'uuid', description: 'Parent category ID for tree hierarchy.' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
