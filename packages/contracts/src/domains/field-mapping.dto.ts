import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    maxLength: 120,
    example: 'title',
    description: 'Canonical field role (title, price, image, …).',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'canonicalField cannot be whitespace-only' })
  @MaxLength(120)
  canonicalField!: string;

  @ApiProperty({
    maxLength: 2000,
    example: 'h1.product-title',
    description: 'CSS selector relative to the product card container.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'selector cannot be whitespace-only' })
  @MaxLength(2000)
  selector!: string;

  @ApiProperty({
    enum: ['text', 'attribute', 'html'],
    example: 'text',
  })
  @IsIn(['text', 'attribute', 'html'])
  type!: 'text' | 'attribute' | 'html';

  /**
   * Required when type === 'attribute', ignored otherwise. Without this
   * guard, `{ canonicalField: 'image', selector: 'img', type: 'attribute' }`
   * validates but breaks downstream attribute extraction.
   */
  @ApiProperty({
    maxLength: 60,
    required: false,
    example: 'href',
    description: 'Required when type === "attribute".',
  })
  @ValidateIf((o: { type?: string }) => o.type === 'attribute')
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'attribute cannot be whitespace-only' })
  @MaxLength(60)
  attribute?: string;
}
