/**
 * Products barrel — re-exports every product DTO.
 *
 * Import patterns:
 *   import { ProductQueryDto, IngestProductsDto } from '@web-scraping/contracts/products';
 *   import { ProductResponseDto, OfferResponseDto, PriceObservationResponseDto } from '@web-scraping/contracts/products';
 *   import type { ProductResponseDto } from '@web-scraping/contracts/products';
 *
 * `UpsertProductDto`/`PriceHistoryResponseDto` were removed by
 * `product-offer-split` (dead `POST /products/upsert` route; price series
 * moved to `PriceObservationResponseDto`, hung off `Offer`).
 */
export { ProductQueryDto } from './product-query.dto.js';
export { IngestProductsDto } from './ingest-products.dto.js';
export { ProductResponseDto } from './product-response.dto.js';
export { ProductListResponseDto, PaginationMetaDto } from './product-list-response.dto.js';
export { OfferResponseDto } from './offer-response.dto.js';
export { PriceObservationResponseDto } from './price-observation-response.dto.js';

