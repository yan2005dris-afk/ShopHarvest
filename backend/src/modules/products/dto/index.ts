/**
 * Re-export shim — the canonical DTOs now live in
 * `@web-scraping/contracts/products`. This file is kept for one release
 * to give any other backend internal import a non-breaking path. Slice
 * 3 will delete it.
 */
export {
  UpsertProductDto,
  ProductQueryDto,
  IngestProductsDto,
  ProductResponseDto,
  PriceHistoryResponseDto,
} from '@web-scraping/contracts/products';
