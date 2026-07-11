# Tasks: Product / Offer / PriceObservation Split

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~350-450 · PR2 ~400-550 · PR3 ~150-250 (≈950-1,250 total) |
| 400-line budget risk | PR1 Medium-High · PR2 High · PR3 Low |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (Schema) → PR2 (Backend) → PR3 (Frontend) — locked at proposal stage |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes (resolved — chain strategy locked at proposal)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema (`Product`/`Offer`/`PriceObservation`/FK changes) + migration + contract DTOs | PR 1 (`feat/product-offer-split-schema` off `develop`) | `pnpm --filter contracts test` | `pnpm --filter backend exec prisma validate` + `prisma migrate deploy` against local db | schema.prisma + migration + contracts revert independently; no backend code depends on them yet |
| 2 | `ProductsService`/`Controller` rewrite (offer-level ingest/read), `RawCapturesController` FK-tightening check | PR 2 (`feat/product-offer-split-backend` off PR1 branch) | `pnpm --filter backend test -- --testPathPattern="products\|raw-captures"` | `pnpm --filter backend start:dev` + manual `POST /products/ingest` smoke | Revertable to PR1 tip without touching schema |
| 3 | Frontend adaptation to offer-level shape | PR 3 (`feat/product-offer-split-frontend` off PR2 branch) | `pnpm --filter frontend test` | `pnpm --filter frontend start` + manual Products page smoke | Revertable without touching backend/schema |

## Phase 1: PR1 — Schema + Migration + Contracts (branch `feat/product-offer-split-schema` off `develop`)

- [x] 1.1 RED — rewrite `packages/contracts/src/products/__tests__/product-response.dto.spec.ts` for canonical-only fields; add `offer-response.dto.spec.ts` + `price-observation-response.dto.spec.ts` under the same `__tests__/` dir (expect failures — DTOs don't exist yet)
- [x] 1.2 GREEN — `backend/prisma/operational/schema.prisma`: rewrite `Product` (canonical: title, description, imageUrl, categoryId?, brandId?), add `Offer` (`productId`, `sourceId`, `domainRuleId?`, `url`, `externalId?`, `sku?`, `price`, `currency`, `@@unique([sourceId, url])`), add `PriceObservation` (`offerId`, `price`, `currency`, `observedAt`), drop `PriceHistory`
- [x] 1.3 GREEN — same schema file: add `DomainRule.sourceId String? @db.Uuid` + `source Source?` relation, `Source.domainRules DomainRule[]` + `Source.offers Offer[]`, `Category.products`/`Brand.products` back-relations, `RawCapture.offer Offer @relation(fields:[offerId], references:[id], onDelete: Cascade)`
- [x] 1.4 Hand-write migration under `backend/prisma/operational/migrations/{timestamp}_product_offer_split/migration.sql` — start with `prisma migrate dev --create-only`; if the shadow-DB replay fails (known pre-existing issue), hand-edit the generated SQL and apply via `prisma db execute --file` + `prisma migrate resolve --applied` (workaround pattern from `fix-analytics-db-wiring`/`remove-etl-product`)
- [x] 1.5 Run `pnpm --filter backend exec prisma generate` to regenerate the operational client
- [x] 1.6 Create `packages/contracts/src/products/offer-response.dto.ts` (id, productId, sourceId, url, externalId, sku, currency, price, extractedAt)
- [x] 1.7 Create `packages/contracts/src/products/price-observation-response.dto.ts` (id, offerId, price, currency, observedAt), replacing `price-history-response.dto.ts`
- [x] 1.8 Rewrite `packages/contracts/src/products/product-response.dto.ts` to canonical fields + `offers: OfferResponseDto[]`
- [x] 1.9 Delete `packages/contracts/src/products/upsert-product.dto.ts` and `packages/contracts/src/products/price-history-response.dto.ts` (dead per spec's "Dead Upsert Endpoint Removed")
- [x] 1.10 Update `packages/contracts/src/products/index.ts` exports to match 1.6-1.9
- [x] 1.11 GREEN — make 1.1's tests pass: `pnpm --filter contracts test`
- [x] 1.12 Verify: `pnpm --filter contracts test` passes (81/81). `pnpm --filter backend build` is RED strictly in `products.service.ts`/`products.controller.ts` (PR2 scope, rewritten in Phase 2) — expected per design's own PR2-depends-on-PR1 branch topology; confirmed no other module is broken except one incidental `DomainRule.products→offers` rename fixed inline in `domains.service.ts` (safety net 13/13 before and after). `prisma validate` + `prisma migrate deploy` against local db both green (see below).
- [x] 1.13 Retarget gate — branch topology created correctly now (PR2 branched off PR1's branch, not `develop`); actual retarget happens only after a human merges PR1 — explicitly NOT done in this apply run per the "do not merge" instruction. Documented here so it isn't skipped later.

## Phase 2: PR2 — Backend Rewrite (branch `feat/product-offer-split-backend` off PR1 branch)

- [x] 2.1 RED — rewrite `backend/src/modules/products/products.service.spec.ts` to assert the new transaction: `Source` upsert (`code=domain`) → `DomainRule.sourceId` backfill → `Product` upsert → `Offer` create/upsert → `PriceObservation` create → `tx.rawCapture.upsert`, all inside one `$transaction`
- [x] 2.2 RED — rewrite `backend/src/modules/products/products.controller.spec.ts` to assert offer-level response shaping and that `POST /products/upsert` no longer exists
- [x] 2.3 RED — update `backend/src/modules/products/__tests__/product-decimal.spec.ts` for the new shape (Offer/PriceObservation Decimal coercion + Product canonical-only). `__tests__/ingest-products.dto.spec.ts` needed NO changes — `IngestProductsDto` itself is untouched by this change; confirmed still green (6/6) before and after.
- [x] 2.4 GREEN — rewrote `ProductsService.ingestFromExtension` in `backend/src/modules/products/products.service.ts` per 2.1's transaction flow, written inline (not via `RawCapturesService`, which holds a separate connection)
- [x] 2.5 GREEN — rewrote the price-history read path (`getPriceHistory`) to query `PriceObservation` across a product's `Offer[]` (`where: { offer: { productId } }`)
- [x] 2.6 GREEN — removed `ProductsService.upsert()`/legacy `create()` admin path and the `UpsertProductDto` import
- [x] 2.7 GREEN — rewrote `backend/src/modules/products/products.controller.ts`: dropped `POST /products/upsert` and the legacy `POST /products` (create), reshaped `findAll`/`findOne`/`findByDomain`/history responses through `ProductResponseDto`/`OfferResponseDto`/`PriceObservationResponseDto`
- [x] 2.8 Verified `backend/src/modules/raw-captures/raw-captures.service.ts`'s standalone `upsert()` against the new FK — added an explicit `offer.findUnique` existence check (mirrors the existing `source` check) throwing `NotFoundException` for a non-existent `offerId`, so it stays a clean 404 instead of an unmapped Prisma P2003 falling through to the global filter's generic 500. RED test added first (`throws NotFoundException when offer does not exist`), confirmed failing, then GREEN.
- [x] 2.9 GREEN — 2.1-2.3's tests pass: `pnpm exec jest --testPathPatterns="products|raw-captures"` → 50/50
- [x] 2.10 Verify: `pnpm --filter backend build` clean; full `pnpm exec jest` → 249/249 passing (includes the incidental `domains.service.ts` rename from PR1, still 13/13)
- [x] 2.11 Retarget gate — branch topology created correctly (PR3 branched off PR2's branch, not `develop`); actual retarget happens only after a human merges PR2 — explicitly NOT done in this apply run per the "do not merge" instruction. Documented here so it isn't skipped later.

## Phase 3: PR3 — Frontend Adaptation (branch `feat/product-offer-split-frontend` off PR2 branch)

- [x] 3.1 RED — created `frontend/src/app/pages/products/products.component.spec.ts` (no existing spec for this component) asserting offer-list rendering (`.prd-offer-row` per Offer) and per-offer price-history requests/attribution (`historyForOffer(offerId)`, `.prd-history-group` per Offer)
- [x] 3.2 GREEN — updated `frontend/src/app/services/api.service.ts` type aliases (`Offer`, `PriceObservation` replacing `PriceHistory`) and `getPriceHistory()`'s return type to the new DTO shapes
- [x] 3.3 GREEN — updated `frontend/src/app/pages/products/products.component.ts`: added `primaryOffer()`/`historyForOffer()`, `selectProduct`/`loadPriceHistory` now operate against `Product.offers[]` and `PriceObservation.offerId`; chart renderer field renamed `capturedAt`→`observedAt`
- [x] 3.4 GREEN — updated `frontend/src/app/pages/products/products.component.html` to list `Offer[]` (price/url/source per offer) instead of flat product fields, and grouped the price-history table per Offer
- [x] 3.5 3.1's spec passes: `pnpm exec vitest run src/app/pages/products/products.component.spec.ts` → 3/3
- [x] 3.6 Verify: `pnpm --filter ./frontend build` clean; `pnpm --filter ./frontend test` → 48 passing, 2 skipped, 2 pre-existing failures in `app.spec.ts` (`window.matchMedia` not polyfilled in the ThemeService test environment) — confirmed unrelated: no diff touches `app.spec.ts`/`theme.service.ts`/`test-setup.ts`, and the failure is present on `feat/product-offer-split-backend` (pre-PR3) too. Reported as pre-existing per Strict TDD's safety-net rule, not fixed (out of this change's scope).

## Phase 4: Final End-to-End Verification

- [x] 4.1 `pnpm --filter backend build && pnpm exec jest` with PR1+PR2 integrated (checked out on `feat/product-offer-split-frontend`, which contains all 3 slices) → build clean, 249/249 tests passing
- [x] 4.2 `pnpm --filter ./frontend build && pnpm --filter ./frontend test` with PR3 integrated → build clean; 48 passing / 2 skipped / 2 pre-existing unrelated failures (`app.spec.ts` `window.matchMedia`, see 3.6)
- [x] 4.3 Docker-compose smoke test: rebuilt `scraper-backend` from the `feat/product-offer-split-frontend` tree (`docker compose build backend && docker compose up -d backend`) against the already-migrated local Postgres. Registered a user, `POST /api/products/ingest` with a visual-mapper-shaped payload → `{"ingested":1,"domainRuleId":"..."}`. Verified via `psql` against `scraper-postgres`: `Product`, `Offer` (with `sourceId`/`domainRuleId` both populated), `sources` (auto-created, `code=domain`), `DomainRule.sourceId` backfilled, `PriceObservation`, and `raw_captures` rows all present and correctly linked. `GET /products/:id` and `GET /products/:id/history` return the new nested `offers[]`/`PriceObservation[]` shape. `POST /products/upsert` confirmed `404` (dead endpoint removed). Frontend page rendering not exercised live (no browser in this environment) — covered instead by `products.component.spec.ts` (3/3, see 3.1/3.5) against the same response shape returned by this live smoke test.
- [x] 4.4 Confirmed `backend/src/modules/pipeline/**` unaffected: no references to `Product`/`Offer`/`PriceHistory` in that module (grep-clean, only unrelated `EtlProduct`/`DimProducto`); `pnpm exec jest --testPathPatterns="pipeline"` → 73/73 passing
