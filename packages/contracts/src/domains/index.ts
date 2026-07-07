/**
 * Domains barrel — re-exports every domain DTO.
 *
 * Import patterns:
 *   import { CreateDomainDto, UpdateDomainDto, DomainResponseDto, FieldMappingDto } from '@web-scraping/contracts/domains';
 *   import type { DomainResponseDto } from '@web-scraping/contracts/domains';
 */
export { FieldMappingDto } from './field-mapping.dto.js';
export { CreateDomainDto } from './create-domain.dto.js';
export { UpdateDomainDto } from './update-domain.dto.js';
export { DomainResponseDto } from './domain-response.dto.js';