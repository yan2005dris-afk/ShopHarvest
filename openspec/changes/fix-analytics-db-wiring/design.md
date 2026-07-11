# Design: Fix Analytics DB Wiring (Stage 1)

## Technical Approach

Provision the analytics Postgres instance with a real `dw` schema (9 tables + 5 KPI views + 1 materialized view), then flip DI so the 3 genuinely-analytics consumers bind to `AnalyticsPrismaService` and `etl-scheduler` binds to `OperationalPrismaService`. Provisioning is a single Prisma baseline migration whose generated table DDL is hand-extended with the Entregable-4 view/matview DDL verbatim, keeping the `dw.` namespace the existing `$queryRawUnsafe` literals already target (proposal Approach 2). The Docker analytics CMD moves from `db push` to `migrate deploy` in lockstep. No SQL literal is edited; the public `/api/analytics/*` contract is untouched.

## Architecture Decisions

### Decision: Migration mechanism for the non-Prisma `dw` objects

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single Prisma migration: generated table DDL + hand-appended view/matview SQL | Views/matview invisible to Prisma introspection (drift undetected) | **Chosen** — one ordered, atomic, history-tracked unit; guarantees tables-before-views; E4 DDL reused verbatim; provisioned by `migrate deploy` alongside tables |
| Separate startup SQL script (psql) after migrate | Out-of-band, untracked, not idempotent, can drift from history | Rejected |
| `prisma db execute` for views only | Splits provisioning across two mechanisms; not in `_prisma_migrations` → partial-provision states | Rejected |

Author via `prisma migrate diff --from-empty --to-schema-datamodel prisma/analytics/schema.prisma` (or `migrate dev --create-only`) for the table DDL, then paste the 5 `CREATE OR REPLACE VIEW`, the `CREATE MATERIALIZED VIEW`, and the `CREATE UNIQUE INDEX idx_mv_resumen_precios` from Entregable 4. The unique index is load-bearing: `refreshMaterializedView()` calls `REFRESH ... CONCURRENTLY`, which requires it.

### Decision: Docker analytics CMD + baselining

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `migrate deploy` for analytics, no `migrate resolve` baseline | Relies on new migration creating only fresh `dw.*` objects | **Chosen** |
| `migrate resolve --applied` baseline (as Fase 0 did for operational) | Unnecessary here | Rejected |

The analytics DB has **no** `_prisma_migrations` history and only empty `public.*` tables left by prior `db push` runs. The init migration creates `dw.*` objects that do **not** collide with those orphans, so `migrate deploy` applies cleanly with no baseline — unlike Fase 0 operational, where migrations recreated already-populated `public` tables. The migration opens with idempotent `DROP TABLE IF EXISTS public.<t> CASCADE` for the 9 db-push orphans (empty, unreferenced) to keep the DB clean. New CMD line (`docker/Dockerfile.backend:83`):

```
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma.operational.config.ts && npx prisma migrate deploy --config prisma.analytics.config.ts && node dist/main.js"]
```

### Decision: `multiSchema` shape on `analytics/schema.prisma`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `schemas = ["dw"]` + `@@schema("dw")` on all 9 models | dw-only | **Chosen** |
| `schemas = ["public","dw"]` (mirror operational) | Declares an unused `public` — no analytics model lives there | Rejected |

Prisma 7.8 multiSchema is GA (operational uses `schemas=[...]` with no `previewFeatures`). The only GA rule is that **every** model/enum carries an explicit `@@schema`; nothing must live in `public`/a default schema. Analytics has zero public models, so list `["dw"]` only. Prisma emits `CREATE SCHEMA IF NOT EXISTS "dw"` in the migration; queries are fully schema-qualified so search_path is irrelevant. **Implementation check**: run `prisma validate --config prisma.analytics.config.ts` before generating the migration — cheap empirical confirmation of the dw-only shape.

## Data Flow

```
AnalyticsService / AnalyticsQueryService ─$queryRawUnsafe(dw.*)─┐
DwLoaderService (typed Dim*/Fact* upserts) ────────────────────┤
                                          AnalyticsPrismaService ─→ analytics PG (dw schema)
EtlScheduler (etlRun.*) ─→ OperationalPrismaService ─→ operational PG (public schema)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/analytics/schema.prisma` | Modify | `datasource.schemas = ["dw"]`; add `@@schema("dw")` to all 9 models |
| `backend/prisma/analytics/migrations/<ts>_init_dw_warehouse/migration.sql` | Create | Generated `dw` table DDL + appended 5 views + matview + unique index; `DROP TABLE IF EXISTS public.*` preamble |
| `backend/prisma/analytics/migrations/migration_lock.toml` | Create | Prisma provider lock (`postgresql`) |
| `docker/Dockerfile.backend:83` | Modify | analytics `db push` → `migrate deploy` |
| `backend/src/modules/analytics/analytics.service.ts` | Modify | inject `AnalyticsPrismaService` |
| `backend/src/modules/analytics/analytics-query.service.ts` | Modify | inject `AnalyticsPrismaService` |
| `backend/src/modules/pipeline/etl/dw-loader.service.ts` | Modify | inject `AnalyticsPrismaService`; replace bare `new PrismaService()` (L455 CLI) with an analytics client |
| `backend/src/modules/pipeline/etl-scheduler.service.ts` | Modify | inject `OperationalPrismaService` (only touches `EtlRun`) |
| `backend/src/modules/{pipeline/etl-scheduler,pipeline/pipeline,analytics/analytics,analytics/analytics-query}.service.spec.ts` | Modify | update mocks to corrected DI targets |

Do **not** touch `backend/src/modules/analytics/dw-loader.service.ts` (DW_LOADER token, no Prisma dep) or the operational `dw` models (Stage 2).

## Interfaces / Contracts

No new interfaces. Constructor injection type swaps only; every method signature and the `/api/analytics/*` request/response shapes are unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | 3 services resolve `AnalyticsPrismaService`; scheduler resolves `OperationalPrismaService` | Jest specs with corrected provider mocks |
| Integration | Every `/api/analytics/*` endpoint returns 200 (empty data, no `relation "dw.*" does not exist`) against a `migrate deploy`d analytics DB | Supertest against provisioned test DB |
| Migration | `migrate deploy` on empty analytics DB creates `dw` schema, 9 tables, 5 views, matview + unique index; `REFRESH ... CONCURRENTLY` succeeds | Ephemeral Postgres |

## Threat Matrix

N/A — the only shell change is a static, non-parameterized container CMD (`prisma migrate deploy`) with no untrusted input; no new routing, subprocess, VCS/PR automation, or executable-file classification. Existing `$queryRawUnsafe` uses hardcoded/whitelisted SQL and is not modified.

## Migration / Rollout

Order within this change (provision-then-flip — zero broken window):
1. Edit `analytics/schema.prisma` (multiSchema); `prisma validate`; generate init migration; append view/matview DDL; regenerate analytics client.
2. Update `Dockerfile.backend:83` to `migrate deploy`.
3. Apply migration; verify `dw.*` objects exist and every analytics endpoint returns 200 (empty).
4. **Then** flip DI in the 3 analytics consumers + dw-loader CLI, and `etl-scheduler` → operational.
5. Update the 4 spec mocks; run full `backend` suite.

Steps 1–3 are additive/non-breaking (nothing reads the new client yet); only step 4 rewires runtime. At deploy time the CMD enforces this automatically — migrations run before `node dist/main.js`, so `dw` is provisioned before the app serves a request. No data migration (analytics starts empty; E4 snapshot discarded). Rollback: `git revert`; the `dw` objects can be dropped independently since nothing else reads them. Operational `dw` untouched (Stage 2).

## Open Questions

None. (One implementation-time confirmation: `prisma validate` on the dw-only schema, folded into step 1.)
