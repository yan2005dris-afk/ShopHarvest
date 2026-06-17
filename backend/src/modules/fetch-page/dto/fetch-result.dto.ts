import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class RectDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

class DetectedElementDto {
  @IsString()
  tag!: string;

  @IsString()
  text!: string;

  @IsString()
  selector!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => RectDto)
  rect!: RectDto;
}

export class FetchResultDto {
  @IsBoolean()
  success!: boolean;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  screenshot?: string;

  @IsOptional()
  @IsObject()
  viewport?: { width: number; height: number };

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetectedElementDto)
  detectedElements?: DetectedElementDto[];

  @IsOptional()
  @IsBoolean()
  captchaDetected?: boolean;

  @IsOptional()
  @IsString()
  error?: string;
}
