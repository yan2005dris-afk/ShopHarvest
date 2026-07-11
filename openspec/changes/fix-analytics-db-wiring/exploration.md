## Exploration: fix-analytics-db-wiring

### Current State

**DI wiring bug confirmed, with one correction to the original bug report.** `backend/src/common/prisma/prisma.service.ts` is a backward-compat shim re-exporting `OperationalPrismaService as PrismaService`. `PrismaModule` provides both `OperationalPrismaService` and `AnalyticsPrismaService` globally, but `AnalyticsPrismaService` is never actually injected anywhere in `backend/src`.

Exactly 8 files import the deprecated shim (verified via grep, not the 4 originally suspected):

- `backend/src/modules/pipeline/etl/dw-loader.service.ts:24` (+ a bare `new PrismaService()` at line 455, a CLI entrypoint outside DI)
- `backend/src/modules/pipeline/etl-scheduler.service.ts:4`
- `backend/src/modules/analytics/analytics.service.ts:2`
- `backend/src/modules/analytics/analytics-query.service.ts:2`
- `backend/src/modules/pipeline/etl-scheduler.service.spec.ts:3`
- `backend/src/modules/pipeline/pipeline.service.spec.ts:30`
- `backend/src/modules/analytics/analytics.service.spec.ts:4`
- `backend/src/modules/analytics/analytics-query.service.spec.ts:5`

**Correction to the original bug report**: `etl-scheduler.service.ts` only calls `prisma.etlRun.*` — `EtlRun` is a `public`-schema **operational** model, not `dw.*`. It must be rewired to `OperationalPrismaService`, not `AnalyticsPrismaService`, or it breaks entirely (no `etlRun` model exists on the analytics client). Only 3 files genuinely need `AnalyticsPrismaService`.

`backend/src/modules/pipeline/etl/__tests__/dw-loader.service.spec.ts` needs no change — it duck-types a mock object, never references the class name. `backend/src/modules/analytics/dw-loader.service.ts` (a second, unrelated `DwLoaderService` that delegates via the `DW_LOADER` DI token) has no direct Prisma dependency and adds no blast radius, just a naming-collision trap worth flagging for whoever implements the fix. All other consumers (`sources`, `categories`, `brands`, `raw-captures`, `products`, `domains`, `users`) already correctly use `OperationalPrismaService` directly.

**A second, deeper bug**: `backend/prisma/operational/schema.prisma` still declares `schemas = ["public","dw"]` and duplicates all 9 `Dim*`/`Fact*` models with `@@schema("dw")`. `backend/prisma/analytics/schema.prisma` has **no multiSchema config at all** — the same 9 models map to the analytics DB's default `public` schema (`@@map` only, no `@@schema("dw")`). But `analytics.service.ts`/`analytics-query.service.ts` use `$queryRawUnsafe` with hardcoded `dw.`-prefixed SQL (`FROM dw.fact_productos`, `dw.v_kpi_precio_promedio_categoria`, etc.). A naive DI-only swap to `AnalyticsPrismaService` would make every analytics endpoint throw `relation "dw.*" does not exist`, because the analytics Postgres instance has no `dw` schema namespace, no KPI views, and no materialized view — confirmed via `backend/prisma/analytics/migrations/` not existing and the Docker CMD using `prisma db push` (bare table creation only) for analytics vs `prisma migrate deploy` for operational.

**Data risk confirmed real**: the operational Postgres instance's `dw` schema was created by hand-written raw SQL during Entregable 4 (`CREATE SCHEMA IF NOT EXISTS dw;` in `docs/entregables/Entregable4_DataWarehouse_Analitica.md:302`), never captured in any Prisma migration (grep confirms zero `CREATE SCHEMA|dw\.` matches across all 10 operational migration files). It holds **168 real product rows + 24 encuesta rows** (snapshot dated 2026-06-30, per `docs/entregables/Reporte_Entregable5.md:212-213`), never refreshed since. The analytics Postgres container uses a fresh volume (`postgres_dw_data`, created in Fase 0) that has never received this data. **Dropping `dw` from operational without first copying this data would destroy the only copy.**

Frontend impact confirmed nil — `dashboard.types.ts`/`dashboard.service.spec.ts` only reference `/api/analytics/*` as HTTP contracts, no DB-specific assumptions.

### Affected Areas

| File | Why Affected |
|------|---------------|
| `backend/src/modules/pipeline/etl/dw-loader.service.ts` | Rewire to `AnalyticsPrismaService`; fix bare `new PrismaService()` CLI entrypoint too. |
| `backend/src/modules/analytics/analytics.service.ts` | Rewire to `AnalyticsPrismaService`. |
| `backend/src/modules/analytics/analytics-query.service.ts` | Rewire to `AnalyticsPrismaService`. |
| `backend/src/modules/pipeline/etl-scheduler.service.ts` | Rewire to `OperationalPrismaService` (NOT Analytics — only touches `EtlRun`). |
| `backend/src/modules/pipeline/etl-scheduler.service.spec.ts`, `pipeline.service.spec.ts`, `analytics.service.spec.ts`, `analytics-query.service.spec.ts` | Update mocks to match the corrected DI targets. |
| `backend/prisma/operational/schema.prisma` | Drop `schemas = ["public","dw"]` multiSchema config and the 9 duplicated `Dim*`/`Fact*` models once the analytics DB is fully provisioned and data is copied. |
| `backend/prisma/analytics/schema.prisma` | Needs a real `dw` schema namespace (or a decision to flatten to `public`), plus KPI views and the materialized view, none of which are Prisma-representable and must be hand-authored SQL migrations. |
| `backend/prisma/analytics/migrations/` | Does not exist yet — needs baselining, matching what Fase 0 did for operational (`docs/aplicado/PLAN-Fase0-split-bases.md` Paso 5). |
| `docker/Dockerfile.backend:83` | CMD currently runs `prisma db push` for analytics vs `prisma migrate deploy` for operational — needs to change in lockstep if analytics moves to real migrations. |
| Operational `dw` schema data (168 product rows + 24 encuesta rows) | Must be copied to the analytics DB before the operational `dw` schema is dropped. |

### Approaches

#### 1. DI-only rewire (imports only)
Swap the import in the 3 genuinely-analytics files, leave everything else as-is.
- **Pros**: Smallest, fastest change.
- **Cons**: Converts a silent wrong-DB-read bug into an immediate runtime 500 (`relation "dw.*" does not exist`), because the analytics DB has no `dw` schema, views, or materialized view yet. Not acceptable alone.
- **Effort**: Low, but incomplete — does not actually fix the bug.

#### 2. Full rewire + provision analytics DB (schema/views/matview + copy the 168+24-row snapshot) + drop `dw` from operational
- **Pros**: Actually fixes the bug end-to-end, matches the documented Fase-0 intent, removes ~129 lines of dead duplicate schema from the operational side.
- **Cons**: Requires hand-authored SQL migration (Prisma can't express views/materialized views), a data-copy step, careful sequencing (copy before drop), and a decision on the Docker CMD change (`db push` → `migrate deploy` for analytics).
- **Effort**: Medium.

#### 3. Full rewire + flatten analytics DB to `public` schema (drop the `dw.` prefix everywhere instead of recreating the namespace)
- **Pros**: Simpler Prisma config, no multiSchema needed on the analytics side.
- **Cons**: Touches roughly a dozen raw SQL literals across 2 files, loses `dw.`-prefixed searchability/consistency with the operational side's naming.
- **Effort**: Medium, larger diff than #2.

### Recommendation

**Approach 2.** Keep the `dw.` namespace — it minimizes the diff in already-verified raw SQL and lets the `Entregable4_DataWarehouse_Analitica.md` DDL be reused as copy-paste source for the hand-authored migration. This is **not** a pure rewiring fix: it needs a design decision on schema-namespace strategy, migration-authoring approach for the views/materialized view, and data-copy sequencing/rollback for the existing snapshot. Route through `sdd-propose` → `sdd-design` before `sdd-tasks`.

### Risks

- **Data-loss risk**: the 168+24-row snapshot exists only in the operational instance's `dw` schema; the drop must be sequenced strictly after a verified copy to analytics.
- Views/materialized view have no Prisma-native representation — this is permanent hand-SQL debt, replicated rather than eliminated by this fix.
- `etl-scheduler.service.ts` must go to `OperationalPrismaService`, not `AnalyticsPrismaService` — the original bug report's 4-file list was wrong on this file specifically.
- No `backend/prisma/analytics/migrations/` exists yet — baselining against the already-`db push`-created analytics DB needs the same one-time fixup Fase 0 did for operational.
- `docker/Dockerfile.backend:83` needs to change in lockstep if analytics moves from `db push` to `migrate deploy`.

### Ready for Proposal
**Yes, with a caveat** — the DI-import part (3 source files + 5 test files, with `etl-scheduler.service.ts` corrected to Operational) is mechanical and low-risk, but it cannot ship alone. It must pair with a genuine design decision on analytics-DB schema/view/data provisioning, so `sdd-design` is required before `sdd-tasks` (not typically true for a pure bugfix change).
