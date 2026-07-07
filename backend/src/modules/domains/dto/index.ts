/**
 * Re-export shim — the canonical DTOs now live in
 * `@web-scraping/contracts/domains`. This file is kept for one release
 * to give any other backend internal import (e.g. services that still
 * use `./dto`) a non-breaking path. Slice 3 will delete it.
 */
export {
  CreateDomainDto,
  UpdateDomainDto,
  FieldMappingDto,
  DomainResponseDto,
} from '@web-scraping/contracts/domains';
