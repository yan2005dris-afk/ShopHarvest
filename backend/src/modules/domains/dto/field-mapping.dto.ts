import {
  IsString,
  IsNotEmpty,
  IsIn,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Shared FieldMapping shape used by:
 * - CreateDomainDto / UpdateDomainDto (rule persistence)
 * - IngestProductsDto (rule sent with each ingest)
 *
 * Mirrors `extension/src/types.ts:FieldMapping`. Keep canonicalField,
 * selector, type, and attribute in sync with the extension when either side
 * changes.
 */
export class FieldMappingDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'canonicalField cannot be whitespace-only' })
  @MaxLength(120)
  canonicalField!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'selector cannot be whitespace-only' })
  @MaxLength(2000)
  selector!: string;

  @IsIn(['text', 'attribute', 'html'])
  type!: 'text' | 'attribute' | 'html';

  /**
   * Required when type === 'attribute', ignored otherwise. Without this
   * guard, `{ canonicalField: 'image', selector: 'img', type: 'attribute' }`
   * validates but breaks downstream attribute extraction.
   */
  @ValidateIf((o: { type?: string }) => o.type === 'attribute')
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'attribute cannot be whitespace-only' })
  @MaxLength(60)
  attribute?: string;
}
