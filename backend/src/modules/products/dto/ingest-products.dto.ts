import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldMappingDto } from '../../domains/dto/field-mapping.dto';

/**
 * Wire shape for `POST /products/ingest`.
 *
 * The extension is authoritative for which field is which, so it MUST send
 * the full `fieldMappings` with each ingest. The backend uses the mappings
 * to map the raw `products` payload into a normalized `Product`.
 *
 * Backward compat: if `fieldMappings` is missing, the backend derives one
 * from the first product's keys and logs a warning. This path will be
 * removed in a future release.
 */
export class IngestProductsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @Matches(/^[a-z0-9.\-:]+$/i, {
    message:
      'domain must be a hostname-like string (letters, digits, dots, hyphens, colons)',
  })
  domain!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, require_valid_protocol: true })
  pageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  @IsOptional()
  fieldMappings?: FieldMappingDto[];

  /**
   * Raw extracted payloads. Each product is a flat record of
   * `canonicalField -> value`. The backend uses `fieldMappings` to assign
   * each key to its semantic role (title, price, image, etc.).
   */
  @IsArray()
  @ArrayNotEmpty({
    message: 'products must contain at least one extracted item',
  })
  products!: Array<Record<string, string | number | null>>;
}
