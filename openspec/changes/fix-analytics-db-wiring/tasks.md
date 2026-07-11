# Tasks: Fix Analytics DB Wiring (Stage 1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-650 (migration DDL is bulk of it) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (provision DB) → PR 2 (flip DI + tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback boundary |
|------|------|-----|--------------|------------------|-------------------|
| 1 | Provision `dw` schema: multiSchema + baseline migration + Dockerfile CMD | PR 1 | `prisma validate --config prisma.analytics.config.ts` | `docker compose up`; verify `dw.*` exists | Additive-only; nothing reads it yet |
| 2 | Flip DI (3 analytics + 1 operational service) + 4 spec mocks | PR 2 | `pnpm --filter backend test` | `start:dev` + `/api/analytics/*` smoke | `git revert`; DI-only, no schema change |

PR 2 depends on PR 1 deployed/verified first.

## Phase 1: Provision Analytics DB

- [x] 1.1 `backend/prisma/analytics/schema.prisma`: add `schemas = ["dw"]` to datasource; add `@@schema("dw")` to all 9 models
- [x] 1.2 Run `prisma validate --config prisma.analytics.config.ts`
- [x] 1.3 Generate table DDL (`migrate diff --from-empty` or `migrate dev --create-only`) into `backend/prisma/analytics/migrations/<ts>_init_dw_warehouse/migration.sql`
- [x] 1.4 Prepend `DROP TABLE IF EXISTS public.<t> CASCADE` (9 orphan tables) to `migration.sql`
- [x] 1.5 Append 5 `CREATE OR REPLACE VIEW` statements verbatim from `docs/entregables/Entregable4_DataWarehouse_Analitica.md:930-1098`
- [x] 1.6 Append `CREATE MATERIALIZED VIEW dw.mv_resumen_precios` (`:1100`) + `CREATE UNIQUE INDEX idx_mv_resumen_precios` (`:1118`)
- [x] 1.7 Create/confirm `backend/prisma/analytics/migrations/migration_lock.toml` (`provider = "postgresql"`)
- [x] 1.8 `prisma generate --config prisma.analytics.config.ts`
- [x] 1.9 `docker/Dockerfile.backend:83` — analytics `db push` → `migrate deploy`, keep ordering: operational deploy → analytics deploy → `node dist/main.js`

## Phase 2: Verify Provisioning

- [x] 2.1 `docker compose up` against fresh `postgres_dw_data` volume; confirm `migrate deploy` applies cleanly
- [x] 2.2 Query `dw.*` tables/views/matview directly; confirm each exists, zero rows
- [x] 2.3 Confirm `REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_resumen_precios` succeeds (validates unique index)

## Phase 3: Flip DI — Analytics Consumers

- [x] 3.1 `backend/src/modules/analytics/analytics.service.ts:2,53` — `PrismaService` → `AnalyticsPrismaService`
- [x] 3.2 `backend/src/modules/analytics/analytics-query.service.ts:2,35` — same swap
- [x] 3.3 `backend/src/modules/pipeline/etl/dw-loader.service.ts:24,79` — same swap (constructor injection)
- [x] 3.4 `backend/src/modules/pipeline/etl/dw-loader.service.ts:455` — replace bare `new PrismaService()` CLI entrypoint with direct `AnalyticsPrismaService` instantiation

## Phase 4: Flip DI — Operational Consumer

- [x] 4.1 `backend/src/modules/pipeline/etl-scheduler.service.ts:4,22` — `PrismaService` → `OperationalPrismaService` (NOT Analytics; only touches `EtlRun`)

## Phase 5: Update Mocks + Verify

- [x] 5.1 `analytics.service.spec.ts:4,114` — mock token → `AnalyticsPrismaService`
- [x] 5.2 `analytics-query.service.spec.ts:5,54` — mock token → `AnalyticsPrismaService`
- [x] 5.3 `etl-scheduler.service.spec.ts:3,48,55` — mock token → `OperationalPrismaService`
- [x] 5.4 `pipeline.service.spec.ts:30,256` — mock token → corrected `dw-loader` DI target (per 3.3)
- [x] 5.5 `rg "common/prisma/prisma.service'" backend/src` — confirm zero matches outside the shim file
- [x] 5.6 `pnpm --filter backend test` — full suite, including 4 updated specs, passes
- [x] 5.7 Docker-compose smoke check: each `/api/analytics/*` endpoint returns 200 with empty-but-well-formed payload against the provisioned empty analytics DB
