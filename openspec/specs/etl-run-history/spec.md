# ETL Run History

## Purpose

Expose ETL run execution records with pagination, server-side filtering, and detail drill-down for operational monitoring in the management UI.

## Requirements

### Requirement: List paginated ETL runs (protected + filterable)

The backend MUST expose `GET /api/pipeline/etl-runs` accepting `page` (default 1, max 100), `limit` (default 20, max 100), `status`, `source`, `from`, `to` query params. Response MUST be `EtlRunListResponseDto` with records ordered by `startedAt` DESC. All requests MUST pass JWT auth (`authGuard`).

| Property | Type | Description |
|----------|------|-------------|
| `data` | `EtlRunDto[]` | Paginated records |
| `meta.page` | `number` | Current page |
| `meta.limit` | `number` | Page size |
| `meta.total` | `number` | Total matching records |
| `meta.totalPages` | `number` | Total pages |

#### Scenario: First page with no filters

- GIVEN 50 ETL run records exist and the user has a valid JWT
- WHEN they call `GET /api/pipeline/etl-runs?page=1&limit=20`
- THEN 20 records return ordered by `startedAt` DESC with `meta.total=50`

#### Scenario: Filter by status=FAILED

- GIVEN 10 failed and 40 successful runs exist
- WHEN they call `GET /api/pipeline/etl-runs?status=FAILED`
- THEN only the 10 failed records appear

#### Scenario: Filter by date range

- GIVEN runs spread across January and February 2026
- WHEN they call `GET /api/pipeline/etl-runs?from=2026-01-01&to=2026-01-31`
- THEN only January runs return

#### Scenario: Empty state

- GIVEN no ETL runs exist
- WHEN any page loads
- THEN `data` is an empty array and `meta.total=0`

#### Scenario: Unauthenticated request denied

- GIVEN no JWT token
- WHEN any list request is made
- THEN the API returns 401

### Requirement: Get single run detail (protected)

The backend MUST expose `GET /api/pipeline/etl-runs/:id` returning `EtlRunDto` with `errorSummary`. Requires JWT. Returns 404 for non-existent IDs.

#### Scenario: Successful detail retrieval

- GIVEN a valid JWT and a known run ID
- WHEN they call `GET /api/pipeline/etl-runs/:id`
- THEN the full run detail including `errorSummary` returns

#### Scenario: Non-existent ID returns 404

- GIVEN a valid JWT
- WHEN they call `GET /api/pipeline/etl-runs/non-existent-id`
- THEN 404 returns
