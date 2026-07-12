## Exploration: Pending Items — Engram Memory & docs/ Analysis

### Current State

The project (`WebScrapingDinamico-Automatico`) is a pnpm monorepo with `apps/api` (NestJS), `apps/web` (Angular), and `packages/shared`. Over the past week (July 7–11, 2026), significant refactoring work has been done across multiple SDD cycles:

- **`frontend-backend-ambiguity`** — ✅ archived (4 PRs merged: contracts package, RFC 7807 errors, toast service, strict mode)
- **`fix-analytics-db-wiring`** — ✅ PRs merged (provision analytics DW schema, DI rewire, drop dead operational `dw` schema duplicate)
- **`fase1a-modelo-operacional`** — ✅ PRs merged (Sources, Categories, Brands with fuzzy match, RawCaptures)
- **`product-offer-split`** — 🔴 **PARTIALLY MERGED** (only PR #21 schema merged; PR #22 backend + PR #23 frontend still open)
- **`dw-add-dim-marca`** — ✅ PR #26 merged to develop

Current `develop` HEAD: `b6a3122` (2026-07-11 15:41).

---

### Findings: Engram Memory

#### 1. Completed & Archived SDD Changes

| Change | Status | Details |
|--------|--------|---------|
| `frontend-backend-ambiguity` | ✅ Archived | 4 PRs merged (#7, #8, #9, #10). Shared `@web-scraping/contracts` package, RFC 7807 error envelope, ToastService, strict mode. |
| `fix-analytics-db-wiring` | ✅ Merged | PR #17 (provision analytics DW: KPI views, materialized view, schema) + PR #18/19 (DI rewire → `AnalyticsPrismaService`). Stage 2 also merged: PR #25 (drop dw duplicate from operational) + PR #27 (shadow-DB fix). |
| `fase1a-modelo-operacional` | ✅ Merged | PR #12 (schema + contracts DTOs), PR #13 (Sources + Categories modules), PR #14 (Brands fuzzy + RawCaptures upsert). |
| `dw-add-dim-marca` | ✅ Merged | PR #26 added `DimMarca` to analytics schema + nullable FK on `FactProducto`. |

#### 2. Partially Completed — `product-offer-split`

This is the **main ongoing refactoring**. The change splits flat `Product`/`PriceHistory` into `Product` (canonical) + `Offer` (product-at-a-site) + `PriceObservation` (time series off Offer).

**What's merged:**
- ✅ PR #21 (`d04f785`) — Schema split: new models + migration in `backend/prisma/operational/schema.prisma`

**What's NOT merged (3 branches still active):**
- ❌ `feat/product-offer-split-backend` — 3 commits ahead of develop (backend rewrite of `ProductsService`/`Controller` to write through new model)
- ❌ `feat/product-offer-split-frontend` — 3 commits ahead (frontend adaptation to offer-level model)
- ❌ `feat/product-offer-split-schema` — 6 commits ahead (includes frontend merged into schema branch)

**Per latest session summary**: PR chain had a stacking bug (user merged PR #22 frontend into PR #21 schema branch via GitHub UI before PR #21 was merged to develop). The explore doc recommended Approach 3 (full vertical slice, chained PRs) but the chain execution was flawed.

#### 3. Recently Merged — Additional Fixes

| PR | Description | Status |
|----|-------------|--------|
| #19 | Land analytics DI rewire onto develop (stale base fix) | ✅ Merged |
| #20 | Remove dead `EtlProduct` model | ✅ Merged |
| #21 | Split Product→Product+Offer+PriceObservation (schema) | ✅ Merged |
| #24 | Fix frontend Docker build (silent no-op) | ✅ Merged |
| #25 | Drop dead `dw` schema duplicate from operational DB | ✅ Merged |
| #26 | Add `dim_marca` dimension to analytics DW | ✅ Merged |
| #27 | Fix shadow-DB replay bug in Prisma migrations | ✅ Merged |

#### 4. Ongoing / Unmerged Work

**Branch: `fix/frontend-build-products-template`** (3 commits ahead of develop):

| Commit | Type | Description |
|--------|------|-------------|
| `a000cd2` | refactor | Consolidate dashboard and visual-mapper modules |
| `a4e7376` | feat | Implement product card, store service, and price chart |
| `49b4f61` | fix | Resolve build syntax errors and stabilize test suite |

This branch is the **most recent active work** and has NOT been merged to develop yet.

---

### Findings: `docs/` Directory

#### `docs/pendiente/` (1 file — the primary pending design)

**`DISENO-modelo-datos-2db.md`** (377 lines, dated 2026-07-10) — The architectural vision document for the data model refactoring. Its 5-phase plan:

| Phase | Status | Notes |
|-------|--------|-------|
| **Fase 0** — Split physical databases | ✅ DONE | Two Postgres containers, two Prisma clients, two schema files. Verified in `PLAN-Fase0-split-bases.md` |
| **Fase 1** — Operational redesign (`Source`, `Category`, `Brand`, `RawCapture`, `Product`→`Product`+`Offer`, rename `PriceHistory`→`PriceObservation`) | 🟡 PARTIAL | Sources/Categories/Brands/RawCaptures done (Fase1a PR #12/#13/#14). Product→Offer split schema done (PR #21) but backend + frontend NOT merged |
| **Fase 2** — DW: add `dim_marca` | ✅ DONE | PR #26 merged to develop |
| **Fase 3** — ETL: implement dw-loader reading from operational | ❌ NOT STARTED | This is `pipeline-consolidation` T6.5 |
| **Fase 4** — Fuzzy product dedup (ML) | ❌ NOT STARTED | Explicitly deferred |

**The key architectural decisions still pending from this doc:**
1. `Product`↔`Offer` identity matching strategy (design doc says "start without dedup, 1 offer = 1 product")
2. `Category`/`Brand` taxonomy: deterministic mapping vs hand-maintained
3. Physical 2nd DB instance in docker-compose already done (Fase 0)

#### `docs/obsoleto/` (1 file — archived/superseded)
- `propuesta_integracion_pipeline.md` — Superseded by pipeline consolidation

#### `docs/aplicado/` (6 files — implemented)
- `PLAN-Fase0-split-bases.md` — ✅ 5/5 steps verified
- `PLAN_CONSOLIDACION_PIPELINE.md` — ✅ pipeline bridge removed, native scrapers in place
- `propuesta-integracion-dw-nestjs.md` — ✅ DW API endpoints exist
- `PLAN_Entregable5_Dashboard_Reporte.md` — ✅ dashboard exists (deploy target mismatch: self-hosted vs originally planned Neon/Render/Vercel)
- `REVIEW-2026-07-03.md` — ✅ 4 criticals resolved
- `REVIEW-2026-07-10-modelo-datos.md` — 🟡 Partial: main recommendation (split bases) done. **EtlProduct still unaddressed at time of writing** — but PR #20 has since removed it.

#### `docs/referencia/` (8 files — likely stale due to post-July-7 changes)
- `architecture.md`, `backend.md`, `database.md`, `docker.md`, `frontend.md`, `worker.md`, `workflow.md`, `flows-current.md`
- All dated before the Fase 0 split and recent refactoring — **probably outdated**

---

### Findings: Code-Level TODO/FIXME Items

| Location | Type | Item |
|----------|------|------|
| `extension/src/popup/popup.ts:9` | TODO(batch-6) | Expose endpoint in settings UI |
| `frontend/.../dashboard.service.spec.ts:103` | TODO | Re-enable test with `fakeAsync` + `tick(500)` once retry logic is stable |
| `backend/.../browser-factory.service.spec.ts:90,112,132` | PLACEHOLDER | Proxy credentials use dummy `customer-XXXX-cc-ec` — needs real test fixture |

---

### Findings: OpenSpec Active Changes (9 folders NOT archived)

| Change Folder | Status | Notes |
|---------------|--------|-------|
| `dw-add-dim-marca` | 🟡 Stale | Has exploration.md only; PR #26 already merged — needs sdd-propose → archive cycle |
| `fase1a-modelo-operacional` | 🟡 Stale | PRs #12/#13/#14 merged — not archived |
| `fix-analytics-db-wiring` | 🟡 Stale | PRs #17/#18/#19/#25/#27 merged — not archived |
| `product-offer-split` | 🔴 ACTIVE | PR #21 merged; PR #22/#23 pending — needs sdd-apply to complete Slice 2 + Slice 3 |
| `implement-scraping-backend-frontend` | 🔴 Unknown | No recent activity visible |
| `implementa-primero-logica-scraping-luego-backend-luego-frontend` | 🔴 Unknown | No recent activity visible |
| `multi-scraper-menus` | 🔴 Unknown | Specs + design + proposal exist, no merge activity |
| `pipeline-consolidation` | 🔴 Unknown | Specs + design + proposal + tasks exist, T6.5 explicitly pending |
| `visual-mapper` | 🔴 Unknown | Full task breakdown exists (1.1 through 3.3), no recent merge activity |

### Recommendation

**The most urgent pending work is:**

1. **`product-offer-split` backend + frontend** — PR #22 and PR #23 need to be merged to complete the Product→Offer refactoring. Currently the schema exists on develop but nothing writes/reads it. This is exactly the "orphan model" anti-pattern the explore doc warned about.

2. **`fix/frontend-build-products-template`** — 3 commits (frontend module consolidation + product card + build fixes) need to be merged to develop.

3. **Archive stale changes** — `dw-add-dim-marca`, `fase1a-modelo-operacional`, and `fix-analytics-db-wiring` are all merged but their openspec folders haven't been archived.

4. **Resume the pipeline-consolidation** — T6.5 (dw-loader wiring) is the biggest remaining gap to close the data pipeline.

### Risks

- The `product-offer-split` schema is on develop but unpopulated — if a new commit adds code that queries the old flat `Product` fields, it will conflict with the new schema shape
- Reference docs in `docs/referencia/` are stale (pre-Fase 0) and will mislead anyone reading them
- 9 openspec change folders in the root indicates accumulated process debt — no discipline for archiving completed changes
- The frontend branch `fix/frontend-build-products-template` builds on top of a stale develop base if product-offer-split-backend is also pending

### Ready for Proposal

**Yes** — the most critical next step is completing `product-offer-split` (backend + frontend PRs), then merging the frontend fixes branch. After that, the team should choose: resume `pipeline-consolidation` (T6.5 ETL wiring), or start archiving completed changes.
