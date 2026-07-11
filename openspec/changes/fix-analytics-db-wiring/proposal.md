# Proposal: Fix Analytics DB Wiring (Stage 1)

## Intent

The physical operational/analytics database split (Fase 0) was never finished at the application layer. `AnalyticsPrismaService` is provided globally but injected nowhere; 3 analytics/ETL services still resolve the deprecated `PrismaService` shim (which re-exports `OperationalPrismaService`), so every analytics read hits the **operational** DB by accident. Meanwhile the analytics Postgres instance was only `prisma db push`-ed: it has no `dw` schema namespace, no KPI views, and no materialized view — the exact objects the analytics services query via hardcoded `dw.`-prefixed `$queryRawUnsafe`. A naive DI swap alone would turn a silent wrong-DB-read into an immediate `relation "dw.*" does not exist` 500. This change rewires DI to the correct clients **and** provisions the analytics DB so the app works end-to-end against the real split.

## Scope

### In Scope
- Rewire the 3 genuinely-analytics consumers (`dw-loader.service.ts`, `analytics.service.ts`, `analytics-query.service.ts`) to `AnalyticsPrismaService`, and fix the bare `new PrismaService()` CLI entrypoint in `dw-loader.service.ts`.
- Rewire `etl-scheduler.service.ts` explicitly to `OperationalPrismaService` (it only touches `EtlRun`, a `public` operational model — original bug report was wrong here).
- Update the 4 affected `.spec.ts` mocks to the corrected DI targets.
- Provision the analytics Postgres instance: a `dw` schema namespace plus the KPI views and materialized view that the raw SQL requires (hand-authored SQL, sourced from `Entregable4_DataWarehouse_Analitica.md` DDL).
- Analytics DB starts **empty**; the real Fase 1a RawCapture → DwLoaderService ETL repopulates it going forward.

### Out of Scope (explicit non-goals / follow-up)
- **Dropping the operational `dw` schema** and its 9 duplicated `Dim*`/`Fact*` models from `operational/schema.prisma` — deferred to a separate **Stage 2** change.
- **Migrating the old `dw` snapshot** (168 product + 24 encuesta rows, dated 2026-06-30) — discarded, not copied. No data-copy step.
- Any change to the analytics HTTP contract or frontend (`/api/analytics/*` stays identical).

## Capabilities

### New Capabilities
- `analytics-warehouse-provisioning`: the analytics DB physically owns the `dw` schema, KPI views, and materialized view; analytics/ETL services bind to `AnalyticsPrismaService`, operational-only services to `OperationalPrismaService`.

### Modified Capabilities
- None (external `/api/analytics/*` behavior is unchanged; this corrects which DB serves it).

## Approach

**Approach 2 from exploration — confirmed.** Keep the `dw.` namespace on the analytics side rather than flattening to `public`. Rationale: it leaves the already-verified `dw.`-prefixed raw SQL untouched (smallest diff, zero SQL-literal edits across 2 files), preserves naming symmetry with the operational side, and lets the Entregable 4 DDL be reused verbatim as the migration source. The tradeoff — the analytics schema needs `multiSchema` config it currently lacks — is a one-time setup cost, cheaper and lower-risk than rewriting ~12 SQL literals (Approach 3). Views/matview remain permanent hand-SQL debt under either approach.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/modules/pipeline/etl/dw-loader.service.ts` | Modified | Inject `AnalyticsPrismaService`; fix bare-`new` CLI entrypoint. |
| `backend/src/modules/analytics/analytics.service.ts` | Modified | Inject `AnalyticsPrismaService`. |
| `backend/src/modules/analytics/analytics-query.service.ts` | Modified | Inject `AnalyticsPrismaService`. |
| `backend/src/modules/pipeline/etl-scheduler.service.ts` | Modified | Inject `OperationalPrismaService` (not Analytics). |
| `*.spec.ts` (4 files) | Modified | Update mocks to corrected DI targets. |
| `backend/prisma/analytics/schema.prisma` | Modified | Add `dw` schema namespace / `multiSchema`. |
| `backend/prisma/analytics/migrations/` | New | Baseline + hand-authored SQL for `dw` schema, views, matview. |
| `docker/Dockerfile.backend:83` | Modified (design decides) | Analytics CMD from `db push` → `migrate deploy`. |
| `backend/prisma/operational/schema.prisma` | Untouched (Stage 2) | `dw` models stay until follow-up. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Naming collision: second `analytics/dw-loader.service.ts` (via `DW_LOADER` token) has no Prisma dep. | Med | Flag to implementer; do not rewire it — no blast radius. |
| Views/matview not Prisma-representable → hand-SQL debt. | High | Author raw SQL migrations from Entregable 4 DDL; `sdd-design` picks the mechanism. |
| `db push` → `migrate deploy` mismatch leaves analytics unmigrated in Docker. | Med | Change Dockerfile CMD in lockstep; `sdd-design` decides baselining vs fresh migrate. |
| Empty analytics DB → endpoints return empty until first ETL run. | Low | Expected/accepted (snapshot discarded by decision); document in success criteria. |

## Rollback Plan

Pure code/config change with no destructive DB step (analytics starts empty, operational untouched). Rollback = `git revert` the change commit(s). The analytics DB objects can be dropped independently since nothing else reads them yet. Operational `dw` schema and its snapshot remain intact throughout (Stage 2 owns their removal).

## Dependencies

- Analytics Postgres instance reachable via `AnalyticsPrismaService` connection string.
- Entregable 4 DDL (`docs/entregables/Entregable4_DataWarehouse_Analitica.md`) as the source for view/matview SQL.

## Success Criteria

- [ ] `AnalyticsPrismaService` is injected in the 3 analytics/ETL consumers; `etl-scheduler` uses `OperationalPrismaService`.
- [ ] No production code imports the deprecated `PrismaService` shim (grep clean); bare `new PrismaService()` CLI entrypoint fixed.
- [ ] Analytics DB has the `dw` schema, KPI views, and materialized view; every `/api/analytics/*` endpoint returns 200 (empty data acceptable) with **no** `relation "dw.*" does not exist`.
- [ ] All 4 updated spec files and the full `backend` suite pass.
- [ ] Operational `dw` schema untouched; explicitly recorded as Stage 2 follow-up.

## Open Questions for sdd-design

1. Migration-authoring mechanism for the non-Prisma objects: `prisma migrate diff` baseline + appended raw SQL, standalone `db execute` scripts, or a hand-written `migration.sql` under a baselined `analytics/migrations/`?
2. Exact `docker/Dockerfile.backend:83` change and whether analytics needs the same one-time baselining Fase 0 did for operational (`db push`-created tables reconciled with a first migration).
3. `multiSchema` config shape on `analytics/schema.prisma` (add `schemas = ["public","dw"]` + `@@schema("dw")` on the 9 models, or a dedicated dw-only datasource).
