## Exploration: dw-add-dim-marca

### Current State

**Analytics schema** (`backend/prisma/analytics/schema.prisma`, one migration so far: `20260711110000_init_dw_warehouse`): 7 dims (`DimProducto`, `DimFuente`, `DimCategoria`, `DimTiempo`, `DimMoneda`, `DimCalificacion`, `DimGenero`) + 2 facts (`FactProducto`, `FactEncuestaConsumo`). Every dim follows the same shape: `id_X Int @id @default(autoincrement()) @map("id_X")`, a unique natural key, `@@map("dim_x")`, `@@schema("dw")`. `FactProducto` wires 5 dim FKs as scalar `Int` fields + typed `@relation`; only `id_calificacion` is nullable (`Int?`) — `id_fuente`/`id_categoria`/`id_tiempo`/`id_moneda` are required.

**`DwLoaderService`** (`backend/src/modules/pipeline/etl/dw-loader.service.ts`): its `ProductRow` interface (lines 35-47) has fields `titulo_oferta`, `url_producto`, `disponibilidad`, `_fuente`, `categoria_normalizada`/`_categoria`, `moneda`, `_extraido_en`, `calificacion`, `precio_usd`, `precio_raw`. **No `marca`/`brand` field exists anywhere** — grep across `backend/` for marca|brand found zero hits in the pipeline/staging path. Dim upserts read from static seed arrays in `etl.constants.ts` (`FUENTES`, `CATEGORIAS`, `MONEDAS`, `CALIFICACIONES`, `GENEROS`); `dim_categoria` also gets `classifyCategory()` keyword classification. Unlike all 7 existing dims (each has *some* real, if imperfect, ETL population path), **`dim_marca` would have zero staging source**.

**`analytics.service.ts`/`analytics-query.service.ts`**: zero brand references in any of the 5 KPI views, the materialized view, or any raw-SQL query method. No "average price by brand" KPI exists or is queued.

**Operational `Brand`** (Fase1a): real table with `pg_trgm` fuzzy matching (`brands.service.ts::fuzzyMatch()`). `Product.brandId` is an explicitly-commented "schema-only, unpopulated FK" (product-offer-split). `BrandsController`/`BrandsService` expose CRUD + `GET /brands/fuzzy?q=` but grep confirms **zero call sites setting `brandId` from any ingestion path** — every fixture has `brandId: null`.

**Migration mechanism**: the one existing analytics migration was generated via `migrate diff --from-empty` (no shadow-DB replay needed, since there was no prior history). Every operational-schema migration since (`remove-etl-product`, `product-offer-split`, `drop-operational-dw-schema`) explicitly documents hitting/working around the known shadow-DB replay bug via `migrate dev --create-only` → hand-edit → `prisma db execute --file` + `prisma migrate resolve --applied`. This change would be the analytics schema's **second** migration ever — the first time `migrate dev` would need to replay migration #1 (hand-written, non-introspectable views/matview) — exactly the shape that has triggered the bug every time on the operational side.

### Affected Areas

**Schema-only scope (recommended):**
- `backend/prisma/analytics/schema.prisma` — add `DimMarca` model + nullable `id_marca Int?` FK + `marca DimMarca?` relation on `FactProducto`
- `backend/prisma/analytics/migrations/<ts>_add_dim_marca/migration.sql` — new hand-written/edited migration (expect shadow-DB workaround)
- `backend/src/generated/analytics/*` — regenerated client

**If extended to real ETL wiring (not recommended, see Risks):**
- `backend/src/modules/pipeline/etl/etl.constants.ts`, `dw-loader.service.ts` — new `MARCAS` seed + `loadDimMarca()` + a duplicate keyword classifier
- Staging generation scripts producing `all_products.json` — would need a new brand field
- `analytics-query.service.ts` + `packages/contracts/src/analytics/*` + frontend — new KPI to give `dim_marca` a consumer

### Approaches

#### 1. Schema-only "Fase 2" (literal design-doc reading)
Add `DimMarca` + nullable FK, migration, regenerate client only.
- **Pros**: Matches design doc's Fase-2 scope exactly; mirrors `fix-analytics-db-wiring`'s precedent (ship schema first, "starts EMPTY" as a stated decision); trivial size, single PR.
- **Cons**: `dim_marca` stays unpopulated with zero consumers — worse than the other 7 dims.
- **Effort**: Low.

#### 2. Full ETL wiring in the same change
Schema + loader + a new pipeline-local keyword brand classifier + new KPI.
- **Pros**: Actually delivers "análisis por marca."
- **Cons**: Requires inventing a second, disconnected brand-classification system that duplicates/conflicts with the pg_trgm fuzzy-match `Brand` catalog just shipped in Fase1a — and operational `Brand`→`Product.brandId` itself has no ingestion wiring yet (separately deferred). Multi-file, crosses contracts/staging/ETL/analytics/frontend.
- **Effort**: High.

#### 3. Defer entirely
Wait until `Product.brandId` auto-classification lands, then source `dim_marca` from the real operational `Brand` catalog per the design doc's own mapping table.
- **Pros**: Avoids disposable/duplicate infrastructure.
- **Cons**: Doesn't close today's gap.
- **Effort**: N/A.

### Recommendation

**Approach 1** — schema-only, explicitly excluding ETL/KPI wiring, flagged as future work gated on the deferred `Product.brandId` auto-classification. Estimated well under 100 changed lines (one model, one FK field, one migration, generated-client diff) — comfortably a single PR.

### Risks

- `dim_marca` will have zero real consumer and no staging source, unlike all 7 existing dims — must be called out explicitly so it isn't mistaken for working coverage.
- Expect (not "maybe") the shadow-DB replay bug on this migration — plan for `migrate dev --create-only` → hand-edit → `db execute` + `migrate resolve --applied` from the start.
- Any future ETL wiring for `dim_marca` must source from the operational `Brand` catalog, not a parallel pipeline-local keyword classifier (would create two disconnected brand systems).
- `id_marca` should be nullable (`Int?`, matching `id_calificacion`), not required — no fallback "sin_clasificar" marca seed is planned.

### Ready for Proposal
**Yes** — scope is clear and small if limited to Approach 1. Confirm with the user whether they want narrow schema-only scope vs. the materially larger, duplicate-risk end-to-end wiring (Approach 2) before proceeding to `sdd-propose`.
