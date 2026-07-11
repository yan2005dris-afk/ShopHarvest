## Exploration: product-offer-split

### Current State

`backend/prisma/operational/schema.prisma:56-99` has flat `Product` (domainRuleId, externalId, title, price, currency, imageUrl, productUrl, sku, description, rawData, extractedAt) and `PriceHistory` (productId, price, currency, capturedAt) — exactly the "three concepts in one table" problem the design doc describes.

**Live write path (the only thing that writes `Product`/`PriceHistory` today)**: Angular `visual-mapper.component.ts` → `ApiService.ingestProducts()` (`frontend/src/app/services/api.service.ts:46-55`) → `POST /products/ingest` → `ProductsController.ingestFromExtension` → `ProductsService.ingestFromExtension` (`backend/src/modules/products/products.service.ts:149-282`). It upserts by `(productUrl, domainRuleId)`, and every non-matching incoming item already creates its own new `Product`. There is no cross-source identity matching — the design doc's recommended "start with no dedup, 1 offer = 1 product" is de facto already how this code behaves.

`POST /products/upsert` (`UpsertProductDto`) has **zero callers** in `frontend/` or `extension/` — dead API surface (confirmed by repo-wide grep).

**Fase1a's `RawCapture` is not wired to this ingestion path at all.** `RawCapture.offerId` (`schema.prisma:372-384`) is a bare `String @db.Uuid` with no FK — there's no `Offer` model yet. `RawCapturesService`/`Controller` are fully standalone; nothing in `ProductsService` calls them or vice versa. Fase1a already shipped an orphan model anticipating an `Offer` that doesn't exist — landing this change schema-only would repeat that exact pattern. Also note: the shipped `RawCapture` diverged from the design doc's original proposal (append-only/immutable, keyed by `sourceId+url`) — it's actually "latest capture, overwrite on re-scrape" keyed by `(offerId, sourceId)`, per Fase1a's own proposal scope note. Any new design must reconcile with the real shipped shape.

**A separate, third system is completely unaffected**: `backend/src/modules/pipeline/` (scraping adapters → staging → `dw-loader.service.ts`) writes directly to `dw.*` tables and never touches `public.Product`/`PriceHistory`/`RawCapture` (confirmed — `dw-loader.service.ts:311` only calls `prisma.dimProducto.create`). Out of scope entirely.

**Fase1a's `Source` and legacy `DomainRule` are unlinked.** The design doc proposed `Source { domainRules DomainRule[] }`, but the shipped `Source` model (`schema.prisma:312-327`) has no `domainRules` relation — only `categories` and `rawCaptures`. `Product.domainRuleId` still FKs to legacy `DomainRule`. Wiring `Offer.sourceId` to `Source` requires resolving this gap — an unresolved design decision, not a detail.

**No production data**: `backend/prisma/seed.ts` seeds nothing into `Product`/`PriceHistory` — greenfield/dev-only, so a clean schema break (drop+recreate) is viable; no data-preserving transform needed.

### Affected Areas

| File | Why Affected |
|------|---------------|
| `backend/prisma/operational/schema.prisma` | Replace flat `Product`/`PriceHistory` with `Product`+`Offer`+`PriceObservation`; resolve `categoryId`/`brandId` and `Offer.sourceId` vs `domainRuleId`. |
| `backend/prisma/operational/migrations/` | Clean schema-change migration (no data transform required — greenfield). |
| `backend/src/modules/products/products.service.ts` (233 lines) | Every method (`ingestFromExtension`, `upsert`, `create`, `getPriceHistory`, `findAll*`) assumes the flat shape and needs rewriting. |
| `backend/src/modules/products/products.controller.ts` | Response shaping changes (price/URL/externalId move off `Product` onto `Offer`). |
| `backend/src/modules/products/products.service.spec.ts`, `products.controller.spec.ts`, `__tests__/ingest-products.dto.spec.ts`, `__tests__/product-decimal.spec.ts` | All mock the flat shape. |
| `packages/contracts/src/products/*` | Need new/renamed DTOs for `Offer`/`PriceObservation`; `ProductResponseDto` shrinks significantly. |
| `frontend/src/app/pages/products/products.component.ts` + `.html` | Currently one flat row with `price`/`productUrl` directly on it, price-history chart keyed by product `id`; needs real UX rework (list `Offer`s, or `Product` with expandable `Offer[]`). |
| `frontend/src/app/services/api.service.ts` | Type aliases and method signatures. |
| `backend/src/modules/raw-captures/*` | If ingestion routes through `RawCapture` per design doc §8, a real `Offer` must exist before/with the raw-capture write. |
| **Not affected** | `backend/src/modules/pipeline/**` (verified separate DW ETL vertical), `extension/**` (no direct backend calls found). |

### Approaches

#### 1. Schema + contracts only, defer ingestion/frontend to a follow-up change
- **Pros**: Small, reviewable, mirrors Fase1a's low-blast-radius pattern.
- **Cons**: Recreates the exact orphan-model problem this change exists to fix (`RawCapture` is already in that state); splits an inherently coupled change into two for PR-size reasons alone.
- **Effort**: Low, but defers all real risk.

#### 2. Big-bang single-PR vertical slice (schema + ingestion rewrite + contracts + frontend, all at once)
- **Pros**: No dangling orphan interval, coherent testable change.
- **Cons**: Unlike Fase1a (purely additive, zero existing consumers touched), this modifies a LIVE endpoint and its real caller plus the products page — plausibly exceeds the 400-line review budget on its own.
- **Effort**: High, high single-PR risk.

#### 3. Full vertical slice, delivered as a chained/stacked-PR sequence within one lineage
E.g. PR1 schema+migration+contracts (mirrors Fase1a PR1) → PR2 rewrite `ProductsService`/`Controller` to write `Product`+`Offer`+`PriceObservation` behind the same route surface → PR3 frontend adaptation.
- **Pros**: Avoids the orphan-interval problem while respecting the 400-line budget per slice; same shape as Fase1a's successful 3-PR chain.
- **Cons**: Requires careful branch retargeting — each child PR must target the previous slice's branch, not the base, or reviewers see stale diffs. This is exactly the failure mode seen in `fix-analytics-db-wiring`'s stacked-PR mishap.
- **Effort**: High overall, but each slice is independently reviewable/rollback-able.

### Recommendation

**Approach 3.** Splitting schema from its consumer (approach 1) just repeats the orphan-`RawCapture` anti-pattern this change is meant to fix, and the design doc's own no-dedup guidance is cheap here since current ingestion already behaves 1-offer-per-item. It must not land as one giant PR (approach 2) — forecast this at `sdd-tasks` time and set `chain_strategy: feature-branch-chain` from the start, with the `fix-analytics-db-wiring` incident as explicit precedent to get retargeting right at each slice boundary.

Two decisions should be made explicit before `sdd-design`, not left implicit:
- `Offer` ↔ site-config FK: `Source` (Fase1a) only, `DomainRule` (legacy) only, or both in parallel pending a later unification?
- Does `categoryId`/`brandId` wiring on the new `Product` include population logic (via `BrandsService.fuzzyMatch`) in this change's first PR, or just the unpopulated FK columns (schema-only, same state `RawCapture.offerId` is in today)?

### Risks

- Modifying the only live write path (`ingestFromExtension`) is a behavior change, not purely additive — regression risk on the one real end-to-end flow is much higher than Fase1a's additions.
- `Offer.sourceId` vs `Product.domainRuleId` ambiguity risks a half-migrated model if unresolved before design.
- Frontend UX genuinely changes (price/URL move off `Product`), not a mechanical rename.
- `RawCapture.offerId` has no referential integrity today; wiring ingestion through it requires the `Offer` row to exist transactionally with the raw-capture write.
- No production data reduces migration risk but also means no real-world validation beyond fixtures/seed.
- PR-chain retargeting discipline is a proven failure point in this repo (`fix-analytics-db-wiring`) — needs an explicit gate at `sdd-tasks`/`sdd-apply`.

### Ready for Proposal
**Yes**, with the two open decisions above flagged for `sdd-propose`/`sdd-design` to resolve explicitly.
