# Design: Product / Offer Split

## Technical Approach

Split the flat operational `Product` into three models — `Product` (canonical),
`Offer` (product-at-a-site), `PriceObservation` (price series off `Offer`) —
per design doc §3.1. Delivered as a `feature-branch-chain` of 3 PRs: PR1 schema
+ migration + contracts, PR2 `ProductsService`/`Controller` rewrite behind the
unchanged `POST /products/ingest` route, PR3 frontend. Greenfield data allows a
clean drop+recreate migration. `categoryId`/`brandId` land as unpopulated
nullable FK columns only.

## Architecture Decisions

### Decision 1: `DomainRule → Source` bridge for `Offer.sourceId`

**Choice**: Add `DomainRule.sourceId String? @db.Uuid` FK (+ `Source.domainRules`).
`ingestFromExtension` upserts a `Source` by `code = dto.domain` (baseUrl
`https://{domain}`), backfills `domainRule.sourceId`, then sets
`Offer.sourceId = source.id`.

**Alternatives considered**: (a) `Offer` FKs `DomainRule` directly — rejected, proposal
locks `Offer.sourceId → Source`. (b) migrate-time `DomainRule→Source` map — rejected,
no production data and the resolution must happen live per ingest since the extension
sends only `domain`, never `sourceId`. (c) `Source.domainRules` back-relation without a
`sourceId` FK column — rejected, needs the scalar FK to resolve in one lookup.

**Rationale**: The extension identifies the site only by `dto.domain`. The `Source`
must be derived server-side. Anchoring the derivation on `DomainRule` (which already
owns `domain @unique`) keeps a single resolution path and preserves extraction lineage.
`sourceId` is nullable on `DomainRule` (no default-hack migration for dev rows); the
service guarantees a `Source` before every `Offer` write, so `Offer.sourceId` is always
non-null even when a legacy rule's `sourceId` was null.

### Decision 2: `RawCapture` wiring

**Choice**: Wire it in PR2 **and** add a real FK `RawCapture.offerId → Offer.id`
(`onDelete: Cascade`) in PR1. The ingest `$transaction` writes in order: `Product`
→ `Offer` (yields `offerId`) → `PriceObservation` → `tx.rawCapture.upsert`.

**Alternatives considered**: Leave `offerId` soft-referenced and unwired (status quo) —
rejected: this change exists to end the orphan-model anti-pattern that shipped
`RawCapture` already embodies; greenfield makes the FK free. Strict "raw capture first"
(design §8) — rejected: the shipped key `(offerId, sourceId)` structurally requires the
`Offer` to exist first, so raw is written last inside the same atomic transaction.

**Rationale**: One transaction gives the four persistence points with real referential
integrity. `ProductsService` writes the capture inline via its own `tx` (not by calling
`RawCapturesService`, which holds a separate connection and would break atomicity).

## Data Model (schema diff)

```prisma
// DomainRule: add source link; swap products[] → offers[]
model DomainRule {
  // ...existing fields...
  sourceId String?  @db.Uuid
  source   Source?  @relation(fields: [sourceId], references: [id])
  offers   Offer[]
  // products Product[]  ← REMOVED
}

// Product: canonical only (flat price/url/externalId REMOVED)
model Product {
  id          String    @id @default(uuid()) @db.Uuid
  title       String
  description String?
  imageUrl    String?
  categoryId  String?   @db.Uuid   // unpopulated
  brandId     String?   @db.Uuid   // unpopulated
  category    Category? @relation(fields: [categoryId], references: [id])
  brand       Brand?    @relation(fields: [brandId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  offers      Offer[]
  @@index([categoryId])
  @@index([brandId])
  @@schema("public")
}

model Offer {
  id           String       @id @default(uuid()) @db.Uuid
  productId    String       @db.Uuid
  product      Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  sourceId     String       @db.Uuid
  source       Source       @relation(fields: [sourceId], references: [id])
  domainRuleId String?      @db.Uuid
  domainRule   DomainRule?  @relation(fields: [domainRuleId], references: [id])
  externalId   String?
  url          String
  sku          String?
  currency     String       @default("USD")
  price        Decimal      @db.Decimal(12, 2)   // latest snapshot
  rawData      Json?
  extractedAt  DateTime     @default(now())
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  priceObservations PriceObservation[]
  rawCaptures  RawCapture[]
  @@unique([sourceId, url])
  @@index([productId])
  @@index([sourceId])
  @@index([externalId])
  @@schema("public")
}

model PriceObservation {           // replaces PriceHistory
  id         String   @id @default(uuid()) @db.Uuid
  offerId    String   @db.Uuid
  offer      Offer    @relation(fields: [offerId], references: [id], onDelete: Cascade)
  price      Decimal  @db.Decimal(12, 2)
  currency   String   @default("USD")
  observedAt DateTime @default(now())
  createdAt  DateTime @default(now())
  @@index([offerId])
  @@index([observedAt])
  @@schema("public")
}

// Source: add back-relations
model Source { /* ...existing... */ domainRules DomainRule[]  offers Offer[] }
// Category / Brand: add  products Product[]
// RawCapture: add FK
model RawCapture {
  // ...existing offerId, sourceId, payload, capturedAt...
  offer Offer @relation(fields: [offerId], references: [id], onDelete: Cascade)
  // @@id([offerId, sourceId]) unchanged
}
```

`PriceHistory` model is dropped.

## Data Flow (ingest)

```
extension → POST /products/ingest → ProductsService.ingestFromExtension
  ├─ upsert Source (code=domain) ─ backfill DomainRule.sourceId
  └─ $transaction, per item:
       Product ─→ Offer(sourceId,url) ─→ PriceObservation ─→ rawCapture.upsert
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/operational/schema.prisma` | Modify | PR1 — models above |
| `backend/prisma/operational/migrations/*_product_offer_split/` | Create | PR1 — drop+recreate (greenfield) |
| `packages/contracts/src/products/product-response.dto.ts` | Modify | PR1 — shrink to canonical fields |
| `packages/contracts/src/products/offer-response.dto.ts` | Create | PR1 — Offer wire shape |
| `packages/contracts/src/products/price-observation-response.dto.ts` | Create | PR1 — replaces price-history dto |
| `packages/contracts/src/products/index.ts` | Modify | PR1 — exports |
| `backend/src/modules/products/products.service.ts` | Modify | PR2 — full rewrite + inline rawCapture |
| `backend/src/modules/products/products.controller.ts` | Modify | PR2 — new DTO shaping; drop dead upsert/create |
| `backend/src/modules/products/**/*.spec.ts`, `__tests__/*` | Modify | PR2 — new shape |
| `frontend/src/app/pages/products/products.component.{ts,html}` | Modify | PR3 — Product + expandable Offer[] |
| `frontend/src/app/services/api.service.ts` | Modify | PR3 — types/signatures |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Source/DomainRule resolution; Product+Offer+PriceObservation+RawCapture in one tx | Jest with `OperationalPrismaService` mock incl. `$transaction` |
| Integration | `POST /products/ingest` writes 3-model shape + capture | Supertest on real/test DB |
| E2E | Products page renders Offer[] + price series | Frontend component test |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary modified. Route surface unchanged.

## Migration / Rollout (branch topology)

`feature-branch-chain` (NOT stacked-to-main — precedent `fix-analytics-db-wiring`
merged a child into a stale parent and never retargeted to develop, half-landing).

- PR1 `feat/product-offer-split-schema` off `develop`; base = develop.
- PR2 `feat/product-offer-split-backend` off PR1 branch; base = PR1 branch.
- PR3 `feat/product-offer-split-frontend` off PR2 branch; base = PR2 branch.
- **Retarget gate before each merge**: after PR1 merges → retarget PR2 base to
  `develop`, rebase to drop PR1 commits, confirm clean diff, then merge. Repeat
  PR3→develop after PR2. Never merge a child into a stale parent branch.

Schema rollback: `prisma migrate reset` (greenfield, no data). Each slice reverts
by reverting its own branch/PR.

## Open Questions

- [ ] None — both deferred decisions resolved above.
