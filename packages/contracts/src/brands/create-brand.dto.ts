import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ maxLength: 120, example: 'Samsung' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: ['Sam', 'SSG'], required: false })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  aliases!: string[];
}
