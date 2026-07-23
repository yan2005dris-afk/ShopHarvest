import type { FieldMappingDto } from '@web-scraping/contracts/domains';
import type { Offer } from './offer.entity';
import type { PriceObservation } from './price-observation.entity';
import type { Product } from './product.entity';

/**
 * Aggregated read result: a Product aggregate plus its offers (and each
 * offer's price observations, when the caller asked for history). This
 * mirrors the legacy `Product.findUnique({ include: { offers: { include:
 * { priceObservations } } } })` shape but stays inside the domain —
 * implementations join via Prisma and the mapper strips the relation
 * back to composed Offer/PriceObservation entities.
 */
export interface ProductLoadOptions {
  /**
   * When true (the legacy default for `GET /products`), each offer is
   * loaded with its `priceObservations`. The frontend relies on this
   * for the in-line price sparkline.
   */
  includeHistory: boolean;
}

export interface ProductLoadResult {
  product: Product;
}

/**
 * Port that the application layer uses to load and persist Product
 * aggregates.
 *
 * Implemented in infrastructure/persistence/prisma-products.repository.ts.
 * Use cases inject the symbol token `PRODUCTS_REPOSITORY` and never see
 * the concrete class.
 *
 * The ingest operation is exposed as a single high-level method because
 * rewriting the canonical Product + Offer + PriceObservation + RawCapture
 * shape requires a Prisma transaction client; threading that through the
 * port would leak Prisma types into the application layer.
 */
export interface ProductsRepository {
  /**
   * Load every persisted Product. By default each Product is shipped
   * with its Offers nested; passing `{ includeHistory: true }` adds
   * `PriceObservation[]` to every offer (the legacy `?includeHistory`
   * default).
   */
  findAll(options: ProductLoadOptions): Promise<Product[]>;
  findById(id: string, options: ProductLoadOptions): Promise<Product | null>;
  /**
   * Returns every Product that has at least one Offer scoped to
   * `domainRuleId`, with only the matching offer(s) nested in the
   * response (mirrors the legacy `findAllByDomain`).
   */
  findAllByDomainRule(domainRuleId: string): Promise<Product[]>;
  /**
   * Price history across a product's Offer(s). Each entry still carries
   * its own `offerId` so multi-offer series stay attributable per-offer.
   * `from`/`to` are inclusive bounds applied to `observedAt`.
   */
  findPriceHistory(
    productId: string,
    range?: { from?: Date; to?: Date },
  ): Promise<PriceObservation[]>;
  /**
   * Hard delete by id. Mirrors the legacy `@Delete(':id')` behaviour;
   * cascade deletes on `Offer` / `PriceObservation` / `RawCapture` are
   * owned by the schema.
   */
  delete(id: string): Promise<void>;
  /**
   * Atomic ingest operation. Owns the transaction (single `$transaction`
   * across Source + DomainRule + Product + Offer + PriceObservation +
   * RawCapture writes). The use case pre-derives `ingestItems` from the
   * inbound payload + field mappings; the repository just persists.
   *
   * Pre-existing `(sourceId, url)` pairs are updated in place (spec:
   * "Re-ingesting the same pair updates, not duplicates"). New pairs
   * create a fresh canonical Product + Offer.
   */
  ingest(command: IngestCommand): Promise<IngestResult>;
}

export interface IngestItem {
  /** Disambiguated URL: `{pageUrl|domain}#{titleSlug}-{batchIndex}`. */
  url: string;
  title: string;
  price: number;
  currency: string;
  sku?: string;
  imageUrl?: string;
  description?: string;
  /** Raw extension payload — round-tripped into `Offer.rawData` and `RawCapture.payload`. */
  raw: Record<string, unknown>;
}

export interface IngestCommand {
  domain: string;
  pageUrl?: string;
  categoryId?: string | null;
  /**
   * Field mappings the caller (extension) supplied. Used by the
   * repository for two things:
   *
   *   1. DomainRule.fieldMappings backfill (only fills when the stored
   *      rule has none — UI-edited mappings are NEVER overwritten).
   *   2. DomainRule auto-creation when no rule exists for the domain
   *      yet. Empty array means "auto-derive from inbound payload".
   *
   * Per-item title/price/sku/etc. are pre-derived by the use case in
   * `IngestItem`s — the repository does not re-parse them.
   */
  fieldMappings: FieldMappingDto[];
  items: IngestItem[];
}

export interface IngestResult {
  ingested: number;
  domainRuleId: string;
}

export const PRODUCTS_REPOSITORY = Symbol('ProductsRepository');

export { Offer, PriceObservation, Product };
