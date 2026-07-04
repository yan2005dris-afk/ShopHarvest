import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldMappingDto } from './field-mapping.dto';

/**
 * Wire shape for `PATCH /domains/:id`. All fields are optional. We hand-roll
 * this instead of using `PartialType` because `@nestjs/mapped-types` is not
 * installed in this workspace.
 */
export class UpdateDomainDto {
  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-z0-9.\-:]+$/i, {
    message:
      'domain must be a hostname-like string (letters, digits, dots, hyphens, colons)',
  })
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fieldMappings?: FieldMappingDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  containerSelector?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productLimit?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true, require_valid_protocol: true })
  sampleUrl?: string;
}
