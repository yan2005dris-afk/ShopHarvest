# Spec — Product Tracking

## 1. Objective

Provide CRUD operations for Product and PriceHistory, with an upsert endpoint that creates or updates a Product by `productUrl` and appends a PriceHistory entry on every update.

## 2. Scope

**In:** Upsert Product by productUrl, PriceHistory CRUD, GET endpoints with history, DTOs with validation.

**Out:** Aggregations, analytics, CSV/export, product comparison.

## 3. Functional Requirements

### 3.1. Upsert Product by URL

The backend MUST expose `POST /api/products/upsert` (or accept via `POST /api/scraping-jobs/:id/result`) that:

- Looks up an existing Product by `productUrl` (scoped to `domainRuleId`).
- If found: updates `title`, `price`, `currency`, `imageUrl`, `sku`, `description`, `rawData`, `extractedAt`.
- If not found: creates a new Product with the provided data.
- On any upsert (create or update): creates a new `PriceHistory` record with the current `price`, `currency`, and `capturedAt = now()`.
- The endpoint MUST validate the request body using class-validator decorators.

### 3.2. Product GET Endpoints

- `GET /api/products` — Returns all products ordered by `updatedAt` DESC, with `priceHistory` included.
- `GET /api/products/:id` — Returns a single product with full price history (join).
- `GET /api/products/by-domain/:domainRuleId` — Filters by domain rule. (Renamed in batch 2 from `/api/products/domain/:domainRuleId`, which was shadowed by `/products/:id` and unreachable.)
- All GET endpoints MUST support `?includeHistory=false` query parameter to optionally exclude price history from the response.

### 3.3. PriceHistory GET Endpoints

- `GET /api/products/:productId/history` — Returns price history for a given product, ordered by `capturedAt` DESC.
- `GET /api/products/:productId/history?from=2025-01-01&to=2026-06-16` — SHOULD support date range filtering.
- `GET /api/price-history?productId=...&domainRuleId=...` — MAY offer an aggregate endpoint.

### 3.4. DTO Validation

The following DTOs MUST be created with class-validator:

- `UpsertProductDto`: `domainRuleId` (UUID), `productUrl` (url), `title` (string, required), `price` (number, positive), `currency` (string, optional, default USD), `imageUrl` (url, optional), `sku` (string, optional), `description` (string, optional), `rawData` (object, optional).
- `ProductQueryDto`: `includeHistory` (boolean, optional, default true), `domainRuleId` (UUID, optional).

## 4. Non-Functional Requirements

- Upsert MUST be idempotent: calling it twice with the same data creates exactly one Product and two PriceHistory entries.
- PriceHistory MUST use `@db.Decimal(12, 2)` precision.
- All endpoints MUST return 400 on validation failure with descriptive error messages.

## 5. Scenarios

### 5.1. First scrape of a product

**Given** no Product exists with `productUrl = "https://example.com/p/123"`  
**When** POST `/api/products/upsert` receives scraped data for that URL  
**Then** a new Product is created  
**And** a PriceHistory entry is created with the current price

### 5.2. Re-scrape of an existing product

**Given** a Product exists with `productUrl = "https://example.com/p/123"` and price 100.00  
**When** POST `/api/products/upsert` receives new data with price 90.00  
**Then** the Product's `price` is updated to 90.00  
**And** a new PriceHistory entry with 90.00 is appended

### 5.3. Validation error

**Given** a request with missing `title` and `productUrl`  
**When** POST `/api/products/upsert` is called  
**Then** the endpoint returns 400  
**And** the response includes validation error details
