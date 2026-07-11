# Delta for analytics-warehouse-provisioning

All requirements are NEW — no existing `analytics-warehouse-provisioning` spec.

## ADDED Requirements

### Requirement: Analytics-Only Services Bind to AnalyticsPrismaService

`DwLoaderService` (`backend/src/modules/pipeline/etl/dw-loader.service.ts`), `AnalyticsService` (`backend/src/modules/analytics/analytics.service.ts`), and `AnalyticsQueryService` (`backend/src/modules/analytics/analytics-query.service.ts`) MUST inject `AnalyticsPrismaService`. None of these three MUST import or resolve the deprecated `PrismaService` shim (which re-exports `OperationalPrismaService`), including the bare CLI entrypoint in `dw-loader.service.ts`.

#### Scenario: DW loader writes to the analytics DB

- GIVEN a quality-passed staging batch ready for load
- WHEN `DwLoaderService.load()` executes, including its CLI (`require.main === module`) entrypoint
- THEN the Prisma client used MUST be `AnalyticsPrismaService`, not the operational client

#### Scenario: Analytics read endpoints query the analytics DB

- GIVEN a request to any `/api/analytics/*` endpoint
- WHEN `AnalyticsService` or `AnalyticsQueryService` runs its `$queryRawUnsafe` calls
- THEN the query MUST execute against `AnalyticsPrismaService`'s connection, not the operational connection

### Requirement: Operational-Only Service Binds to OperationalPrismaService

`EtlSchedulerService` (`backend/src/modules/pipeline/etl-scheduler.service.ts`) only reads/writes the `public.EtlRun` model, which exists solely on the operational DB. It MUST inject `OperationalPrismaService` and MUST NOT be rewired to `AnalyticsPrismaService`.

#### Scenario: ETL scheduler reads/writes EtlRun on the operational DB

- GIVEN a scheduled ETL run is created or updated
- WHEN `EtlSchedulerService` calls `prisma.etlRun.*`
- THEN the Prisma client used MUST be `OperationalPrismaService`

### Requirement: No Production Code Uses the Deprecated Shim

After this change, no file under `backend/src` (excluding the shim's own definition) MUST import `PrismaService` from `backend/src/common/prisma/prisma.service.ts`. All four `.spec.ts` mocks for the rewired services MUST reflect the corrected DI token per service.

#### Scenario: Grep confirms shim is unused

- GIVEN the completed DI rewiring
- WHEN searching `backend/src` for imports of the deprecated `PrismaService` shim
- THEN zero matches MUST be found outside the shim's own file

#### Scenario: Updated specs pass under the corrected DI

- GIVEN the 4 updated `.spec.ts` files (`etl-scheduler.service.spec.ts`, `pipeline.service.spec.ts`, `analytics.service.spec.ts`, `analytics-query.service.spec.ts`)
- WHEN the backend test suite runs (`pnpm --filter backend test`)
- THEN every updated spec and the full backend suite MUST pass

### Requirement: Analytics DB Physically Provisions the dw Schema

The analytics Postgres instance MUST have a `dw` schema namespace containing every table, KPI view, and the materialized view that `analytics.service.ts` and `analytics-query.service.ts` reference via hardcoded `dw.`-prefixed raw SQL. Provisioning MUST leave the analytics DB empty of business data (no copy of the discarded operational snapshot).

#### Scenario: dw schema objects exist and are queryable

- GIVEN a freshly provisioned analytics Postgres instance
- WHEN any `dw.`-prefixed table, KPI view, or the materialized view referenced by analytics raw SQL is queried directly
- THEN the query MUST succeed (object exists) and return zero rows

#### Scenario: Analytics endpoints return empty-state, not errors

- GIVEN the freshly provisioned, empty analytics DB
- WHEN any `/api/analytics/*` endpoint is called
- THEN the response MUST be HTTP 200 with an empty-but-well-formed payload (per the endpoint's existing response shape), and MUST NOT be an HTTP 500 or a `relation "dw.*" does not exist` error

### Requirement: Public API Contract Unchanged

`/api/analytics/*` request/response shapes MUST remain byte-identical to their pre-change contract. This change alters only which physical database backs each endpoint.

#### Scenario: Endpoint contract regression check

- GIVEN the pre-change and post-change OpenAPI/response shape for a given `/api/analytics/*` endpoint
- WHEN compared
- THEN the request parameters and response schema MUST be identical

## Out of Scope (Non-Goals)

These boundaries are explicitly documented, not deferred requirements:

- **Operational `dw` schema removal**: `backend/prisma/operational/schema.prisma` keeps its `schemas = ["public","dw"]` config and the 9 duplicated `Dim*`/`Fact*` models untouched. Their removal is a separate, future Stage 2 change and is NOT part of this spec.
- **Historical snapshot migration**: The existing operational `dw` schema's 168 product rows + 24 encuesta rows (dated 2026-06-30) are NOT copied to the analytics DB. Per product decision, this snapshot is discarded; the analytics DB starts empty and is repopulated only by the real Fase 1a RawCapture -> DwLoaderService ETL going forward.
