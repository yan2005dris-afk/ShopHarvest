import type { FieldMappingDto } from '@web-scraping/contracts/domains';
import type { Offer } from './offer.entity';
import type { PriceObservation } from './price-observation.entity';
import type { Product } from './product.entity';

export interface ProductLoadOptions {
  includeHistory?: boolean;
}

export interface ProductListQuery {
  page: number;
  limit: number;
  q?: string;
}

export interface ProductLoadResult {
  product: Product;
}

/**
 * Port that the application layer uses to load and persist Product
 * aggregates.
 */
export interface ProductsRepository {
  /**
   * Load paginated Products. Supports diacritic and case-insensitive search
   * via optional `q`. Returned products omit price history on offers.
   */
  findAll(query: ProductListQuery): Promise<{ items: Product[]; total: number }>;
  findById(id: string, options?: ProductLoadOptions): Promise<Product | null>;
  /**
   * Returns every Product that has at least one Offer scoped to
   * `domainRuleId`, with only the matching offer(s) nested in the
   * response (mirrors the legacy `findAllByDomain`).
   */
  findAllByDomainRule(domainRuleId: string): Promise<Product[]>;
  /**
   * Price history across a product's Offer(s).
   */
  findPriceHistory(
    productId: string,
    range?: { from?: Date; to?: Date },
  ): Promise<PriceObservation[]>;
  /**
   * Hard delete by id.
   */
  delete(id: string): Promise<void>;
  /**
   * Atomic ingest operation.
   */
  ingest(command: IngestCommand): Promise<IngestResult>;
}

export interface IngestItem {
  url: string;
  title: string;
  price: number;
  currency: string;
  sku?: string;
  imageUrl?: string;
  description?: string;
  raw: Record<string, unknown>;
}

export interface IngestCommand {
  domain: string;
  pageUrl?: string;
  categoryId?: string | null;
  fieldMappings: FieldMappingDto[];
  items: IngestItem[];
}

export interface IngestResult {
  ingested: number;
  domainRuleId: string;
}

export const PRODUCTS_REPOSITORY = Symbol('ProductsRepository');

export { Offer, PriceObservation, Product };
