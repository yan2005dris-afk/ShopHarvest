# Delta for product-offer-catalog

## ADDED Requirements

All requirements are NEW — no existing `product-offer-catalog` spec.

Refer to `openspec/specs/product-offer-catalog/spec.md` for the full specification once archived.

### Requirement: Canonical Product/Offer/PriceObservation Split

The system MUST represent a canonical product (`Product`) separately from a site-specific listing (`Offer`) and separately from a price-over-time record (`PriceObservation`). `Offer` MUST reference its owning `Product` and its originating `Source`. `PriceObservation` MUST reference its owning `Offer`, not `Product` directly.

#### Scenario: Product and Offer are distinct rows

- GIVEN an item ingested from one source
- WHEN ingestion completes
- THEN a `Product` row and a separate `Offer` row exist, linked by `Offer.productId`

#### Scenario: Price observations hang off Offer

- GIVEN an `Offer` with a captured price
- WHEN price history is queried
- THEN the price appears as a `PriceObservation` linked to that `Offer`, not to `Product` directly

### Requirement: One Offer Per Ingested Item (No Dedup)

The system MUST create a new `Product` and a new `Offer` for every newly ingested `(sourceId, url)` pair — the `Offer`'s natural key (`@@unique([sourceId, url])`). Cross-source or cross-item identity matching MUST NOT occur.

#### Scenario: Two distinct items create two products

- GIVEN two items ingested from the same source with different URLs
- WHEN both are ingested
- THEN two separate `Product` rows and two separate `Offer` rows are created

#### Scenario: Re-ingesting the same pair updates, not duplicates

- GIVEN an existing `Offer` for a `(sourceId, url)` pair
- WHEN the same pair is ingested again with a new price
- THEN the existing `Offer` is reused and a new `PriceObservation` is recorded, without creating a duplicate `Product`/`Offer`

### Requirement: Extension Ingestion Route Contract Preserved

`POST /products/ingest` MUST keep accepting the request shape used by the visual-mapper extension and MUST return a response shape compatible with existing callers, now sourced from `Product`+`Offer`+`PriceObservation`.

#### Scenario: Existing ingestion payload is accepted

- GIVEN a request payload shaped as today's extension ingestion call
- WHEN it is POSTed to `/products/ingest`
- THEN the request is accepted and processed without a contract-breaking change

#### Scenario: Response remains consumable by the extension flow

- GIVEN a successful ingestion
- WHEN the response is returned
- THEN it contains fields sufficient for the visual-mapper flow to continue working unmodified

### Requirement: Dead Upsert Endpoint Removed

`POST /products/upsert` and `UpsertProductDto` MUST be removed; exploration confirmed zero callers.

#### Scenario: Upsert endpoint no longer available

- GIVEN the new model is deployed
- WHEN a client requests `POST /products/upsert`
- THEN the route no longer exists

### Requirement: Price History Retrieval Across Offers

The system MUST provide price history for a product sourced from `PriceObservation` records across all of that product's `Offer`(s).

#### Scenario: Product with a single offer

- GIVEN a `Product` with exactly one `Offer`
- WHEN price history is requested for that product
- THEN the response contains the `PriceObservation` series for that one `Offer`

#### Scenario: Product with multiple offers (future-proofing)

- GIVEN a `Product` with more than one `Offer` (dedup itself is not implemented)
- WHEN price history is requested for that product
- THEN observations are attributable per `Offer`, not merged into one undifferentiated series

### Requirement: Category/Brand Association Columns

`Product` MUST include `categoryId` and `brandId` foreign-key columns. These columns MAY remain null/unpopulated. Automatic population (e.g., fuzzy brand matching) is explicitly NOT required by this capability.

#### Scenario: Ingested product has no category/brand assigned

- GIVEN an item ingested via the extension flow
- WHEN the resulting `Product` is created
- THEN `categoryId` and `brandId` are present as nullable fields and are not auto-populated

### Requirement: Frontend Contracts Reflect Offer-Level Data

`packages/contracts/src/products/*` response DTOs MUST expose price, url, and externalId at the offer level, describing each product's offers as a list rather than flat product fields.

#### Scenario: Product response includes a list of offers

- GIVEN a product with one or more offers
- WHEN its contract response is serialized
- THEN the response includes a list of offers, each carrying its own price/url and its own price-observation series

### Requirement: Non-Goals Explicit

The pipeline/DW ETL module (`backend/src/modules/pipeline/**`) MUST NOT be affected. No production-data migration transform is required (greenfield, no seeded `Product` data).

#### Scenario: Pipeline module is unaffected

- GIVEN this capability is implemented
- WHEN the pipeline/DW ETL flow runs
- THEN it continues writing to `dw.*` tables unchanged

### Requirement: RawCapture Referential Integrity

`RawCapture.offerId` MUST reference `Offer.id` through a real foreign key and MUST be populated transactionally as part of the same ingestion transaction that creates/upserts the `Offer` — not as a loosely-typed UUID with no referential guarantee.

#### Scenario: RawCapture is written inside the ingest transaction

- GIVEN an item is ingested via `POST /products/ingest`
- WHEN the ingest transaction commits
- THEN the resulting `RawCapture` row's `offerId` references a real, existing `Offer` row via foreign key
