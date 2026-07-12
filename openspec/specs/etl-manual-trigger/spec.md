# ETL Manual Trigger

## Purpose

Allow authenticated users to trigger a manual ETL run via the management UI. Returns immediately (async execution) and reuses the existing idempotency check.

## Requirements

### Requirement: Trigger manual ETL run

The backend MUST expose `POST /api/pipeline/etl-runs/trigger` accepting an empty body. On invocation it MUST create a new `EtlRun` with `status=RUNNING`, `source='manual'` and return `TriggerEtlResponseDto { runId, status: 'RUNNING' }`. The endpoint MUST be protected by JWT auth (`authGuard`).

#### Scenario: Happy trigger

- GIVEN an authenticated user on the ETL management page
- WHEN they click "Ejecutar ETL" and confirm
- THEN `POST /api/pipeline/etl-runs/trigger` returns 201 with `{ runId: "...", status: "RUNNING" }`
- AND the run appears in the paginated list with RUNNING badge

### Requirement: Idempotency — reuse existing RUNNING run

If a manual ETL run with `status=RUNNING` and `source='manual'` already exists, the endpoint MUST return the existing `runId` instead of creating a duplicate. This reuses `EtlSchedulerService.runEtlTick()`'s existing RUNNING check.

#### Scenario: Concurrent trigger returns existing run

- GIVEN a manual ETL run is currently RUNNING
- WHEN a second trigger POST arrives
- THEN the response returns 200 (not 201) with the existing `runId`
- AND no duplicate run is created

### Requirement: Auth required

All requests MUST pass JWT auth. Unauthenticated requests return 401.

#### Scenario: Unauthenticated trigger denied

- GIVEN no JWT token
- WHEN they POST to `/api/pipeline/etl-runs/trigger`
- THEN 401 returns
