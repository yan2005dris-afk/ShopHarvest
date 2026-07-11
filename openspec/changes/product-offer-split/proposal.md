# Proposal: Product / Offer Split

## Intent

Today's operational `Product` (`schema.prisma:56-99`) crushes **three distinct concepts into one table** — the canonical product, the site-specific listing, and the price series — exactly the anti-pattern flagged in `docs/pendiente/DISENO-modelo-datos-2db.md` §3. `PriceHistory` hangs off `Product`, so "one product, several prices" cannot hold across sites, and category/brand live buried in `rawData`. This change splits the flat model into `Product` (canonical) + `Offer` (product-at-a-site) + `PriceObservation` (price over time, hung off `Offer`), realizing the design doc's §3.1 model and unblocking cross-site comparison and taxonomy queries.

## Scope

### In Scope
- Replace flat `Product`/`PriceHistory` with `Product` + `Offer` + `PriceObservation` (design doc §3.1 shape).
- `Offer.sourceId` FKs to Fase1a's `Source`; `PriceObservation` hangs off `Offer`.
- `Product.categoryId`/`brandId` as **schema-only unpopulated FK columns**.
- Rewrite `ProductsService.ingestFromExtension`/`Controller` behind the same `POST /products/ingest` route surface; adapt contracts DTOs and the products frontend page (price/URL/externalId move off `Product` onto `Offer`).
- Delivered as a vertical slice — NOT schema-only.

### Out of Scope
- Category/brand **auto-population** (`BrandsService.fuzzyMatch`, any classification logic) — future phase.
- Fuzzy product-identity matching / cross-source dedup — **1 offer = 1 product** for now (design doc §3.3, §9).
- Pipeline / DW vertical (`backend/src/modules/pipeline/**`, `dw.*`) — confirmed separate.
- Dead `POST /products/upsert` surface — zero callers.

## Capabilities

### New Capabilities
- `product-offer-catalog`: canonical `Product` ↔ `Offer` ↔ `PriceObservation` model plus extension ingestion behind the existing route.

### Modified Capabilities
- None (no existing spec covers the flat `Product`).

## Approach

**Chained PRs, `feature-branch-chain` strategy** (matches exploration Approach 3; avoids the schema-only orphan repeat and the single-PR 400-line overrun). Three slices:

| Slice | Files |
|---|---|
| PR1 schema + migration + contracts | `backend/prisma/operational/schema.prisma`, `.../migrations/`, `packages/contracts/src/products/*` |
| PR2 backend rewrite | `products.service.ts`, `products.controller.ts`, their `*.spec.ts` + `__tests__/*` |
| PR3 frontend | `frontend/src/app/pages/products/products.component.{ts,html}`, `services/api.service.ts` |

Each child PR targets the previous slice's branch (retarget/rebase until the diff is clean) — the `fix-analytics-db-wiring` stacked-to-main mishap is explicit precedent to avoid. Greenfield data (`seed.ts` seeds no `Product`) permits a clean drop+recreate migration.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Regression on the only live write path (`ingestFromExtension`) | Med | Same route surface + spec coverage in PR2 |
| PR-chain mis-retargeting (repo precedent) | Med | Retarget gate at each slice boundary |
| Frontend UX is real rework, not a rename | Med | Isolated in PR3 |

## Rollback Plan

Per-slice: revert the PR branch. Schema: `prisma migrate reset` (greenfield, no data). Slices are independently reversible.

## Open Questions (for sdd-design)

1. **`Offer.sourceId` → `Source` FK resolution.** Fase1a's shipped `Source` has no `domainRules` relation; legacy `Product.domainRuleId` FKs `DomainRule`. Add the `Source.offers`/`domainRules` relation now vs. map `DomainRule`→`Source` during migration — **decide in sdd-design**.
2. **RawCapture ingestion wiring.** Does routing `ingestFromExtension` through `RawCapture` (design doc §8 four-persistence-points flow) belong in PR2, or is it a later change? Exploration flagged this as ambiguous — **decide in sdd-design**.

## Success Criteria

- [ ] `prisma migrate dev` runs clean; `Product`/`Offer`/`PriceObservation` exist per §3.1.
- [ ] `POST /products/ingest` writes the three-model shape behind the unchanged route contract.
- [ ] Products page renders `Product` with its `Offer`(s) and price series off `Offer`.
- [ ] Each slice lands under the 400-line budget with correct branch retargeting.
