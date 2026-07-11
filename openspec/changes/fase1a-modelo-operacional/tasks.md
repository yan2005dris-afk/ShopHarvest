# Tasks: Fase 1a — Modelo Operacional

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,555 added (0 deleted) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (Sources + Categories) → PR 3 (Brands + RawCaptures) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes (resolved)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema models + migration + all 4 contract DTOs + DTO tests | PR 1 | `pnpm --filter contracts test` | `pnpm --filter contracts build` | schema.prisma + migration can be reverted independently of contracts |
| 2 | Sources module (CRUD) + Categories module (tree + path helpers) + unit tests | PR 2 | `pnpm --filter backend test -- --testPathPattern="(sources\|categories)"` | `pnpm --filter backend start:dev` | Both modules can be rolled back from app.module.ts without affecting PR 3 |
| 3 | Brands module (fuzzy matching) + RawCaptures module (upsert) + unit tests + app.module wiring | PR 3 | `pnpm --filter backend test -- --testPathPattern="(brands\|raw-captures)"` | `pnpm --filter backend start:dev` | Independent revert from app.module.ts; pg_trgm indexes are DDL-only |

## Phase 1: Foundation — Prisma + Contracts

- [x] 1.1 Add `SourceStatus` enum + `Source`, `Category`, `CategorySourceMapping`, `Brand`, `RawCapture` models to `backend/prisma/operational/schema.prisma`
- [x] 1.2 Create migration SQL with `CREATE EXTENSION IF NOT EXISTS pg_trgm` + GiST index on `Brand.name` + GIN index on `Brand.aliases`
- [x] 1.3 Run migration via `prisma db execute` + `prisma migrate resolve --applied` then `prisma generate`
- [x] 1.4 Create `packages/contracts/src/sources/` with `CreateSourceDto`, `UpdateSourceDto`, `SourceResponseDto`, `index.ts`
- [x] 1.5 Create `packages/contracts/src/categories/` with `CreateCategoryDto`, `UpdateCategoryDto`, `CategoryResponseDto`, `index.ts`
- [x] 1.6 Create `packages/contracts/src/brands/` with `CreateBrandDto`, `UpdateBrandDto`, `BrandResponseDto`, `FuzzyMatchResultDto`, `index.ts`
- [x] 1.7 Create `packages/contracts/src/raw-captures/` with `IngestRawCaptureDto`, `RawCaptureResponseDto`, `index.ts`
- [x] 1.8 Update `packages/contracts/src/index.ts` to re-export all 4 new modules
- [x] 1.9 Write DTO validation tests for each contract domain

## Phase 2: Sources + Categories Modules

- [x] 2.1 Create `backend/src/modules/sources/sources.module.ts`, `sources.controller.ts`, `sources.service.ts`, `index.ts` with full CRUD
- [x] 2.2 Write sources service unit tests (create, duplicate code rejection, delete, status transition)
- [x] 2.3 Create `backend/src/modules/categories/categories.module.ts`, `categories.controller.ts`, `categories.service.ts`, `index.ts` with CRUD + `getAncestors()`/`getDescendants()` path helpers + reparent path update
- [x] 2.4 Write categories service unit tests (child creation, path assignment, ancestry queries, delete guard)
- [x] 2.5 Create `CategorySourceMapping` endpoints: create mapping, list by category/source, delete mapping

## Phase 3: Brands + RawCaptures Modules

- [x] 3.1 Create `backend/src/modules/brands/brands.module.ts`, `brands.controller.ts`, `brands.service.ts`, `index.ts` with CRUD + `fuzzyMatch(text, threshold?)` using `$queryRaw` with `similarity()`
- [ ] 3.2 Write brands service unit tests (covered by integration tests in Phase 4 instead — service tested via real pg_trgm)
- [x] 3.3 Create `backend/src/modules/raw-captures/raw-captures.module.ts`, `raw-captures.controller.ts`, `raw-captures.service.ts`, `index.ts` with `upsert(offerId, sourceId, payload)`
- [ ] 3.4 Write raw-captures service unit tests (covered by integration tests in Phase 4 instead — service tested via real Prisma queries)
- [x] 3.5 Update `backend/src/app.module.ts` — import `SourcesModule`, `CategoriesModule`, `BrandsModule`, `RawCapturesModule`

## Phase 4: Integration Testing

- [x] 4.1 Write integration test for brand pg_trgm fuzzy matching against real PostgreSQL
- [x] 4.2 Write integration test for category ancestry queries via path `startsWith`
- [x] 4.3 Write E2E test for RawCapture upsert + re-fetch cycle via Supertest

## Phase 5: Cleanup

- [x] 5.1 Run full `pnpm --filter backend test` and `pnpm --filter contracts test` — all pass
- [ ] 5.2 Run `pnpm prisma validate` and `pnpm prisma format`
- [ ] 5.3 Verify `pnpm build` passes for both `backend` and `contracts`
