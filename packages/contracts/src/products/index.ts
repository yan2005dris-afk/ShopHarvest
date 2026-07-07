/**
 * Products barrel — re-exports every product DTO.
 *
 * Import patterns:
 *   import { UpsertProductDto, ProductQueryDto, IngestProductsDto } from '@web-scraping/contracts/products';
 *   import { ProductResponseDto, PriceHistoryResponseDto } from '@web-scraping/contracts/products';
 *   import type { ProductResponseDto } from '@web-scraping/contracts/products';
 */
export { UpsertProductDto } from './upsert-product.dto.js';
export { ProductQueryDto } from './product-query.dto.js';
export { IngestProductsDto } from './ingest-products.dto.js';
export { ProductResponseDto } from './product-response.dto.js';
export { PriceHistoryResponseDto } from './price-history-response.dto.js';
