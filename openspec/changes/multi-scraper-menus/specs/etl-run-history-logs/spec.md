# Spec — ETL Run History & Logs

## 1. Objective

The backend SHALL expose `EtlRun` summaries via `GET /api/pipeline/runs`, and the frontend SHALL display them in a run-history panel on `/scrapers` with reactive state transitions. The frontend MUST poll at a 5 000 ms cadence while any visible run is non-terminal and MUST stop polling once all visible runs reach a terminal state (`success` or `failed`).

## 2. Scope

**In:**

- A new `GET /api/pipeline/runs` endpoint in `backend/src/modules/pipeline/pipeline.controller.ts`.
- A `runs` query in `PipelineService` that reads from `public.EtlRun` with a configurable page size (default 50).
- A frontend run-history section on the scrapers page that lists EtlRun summaries including state, source, startedAt, and finishedAt.
- A polling mechanism (Angular `effect()` plus `setInterval`/`setTimeout`) at a 5 s cadence while non-terminal runs exist.
- Stopping polling once all visible runs reach a terminal state.

**Out:**

- Streaming live logs from Playwright. Only state, source, and timestamps are in scope.
- Server-Sent Events or WebSocket transport. HTTP polling is sufficient for this change.
- Persisting new EtlRun states from the frontend (read-only view).
- Server-side cross-source aggregation. The endpoint returns rows; the frontend does the grouping/display.

## 3. Functional Requirements

### 3.1. Backend Endpoint

- The `PipelineController` SHALL expose `GET /api/pipeline/runs` returning a JSON array of `EtlRunSummary` objects.
- A DTO `EtlRunSummaryDto` MUST serialize at minimum: `id` (string), `source` (string), `state` (`queued` | `running` | `success` | `failed`), `startedAt` (ISO 8601 UTC timestamp), `finishedAt` (ISO 8601 UTC timestamp | null).
- The endpoint SHOULD accept `?source=<id>` to filter by a single source and SHOULD accept `?limit=<n>` (default 50, max 100) for pagination.
- The endpoint MUST return runs ordered by `startedAt` descending (most recent first).
- Timestamps MUST be stored and returned in UTC.

### 3.2. Frontend Polling Lifecycle

- The scrapers page MUST start a 5 000 ms polling loop that calls `GET /api/pipeline/runs` whenever at least one run in the current view is in `queued` or `running`.
- The polling loop MUST stop when the latest response contains zero non-terminal runs in the visible set.
- The polling loop MUST restart automatically when a new `queued` or `running` run is observed (e.g., after a fresh trigger).
- A stale-response guard MUST cancel an in-flight request if a newer one is fired (`switchMap` in RxJS or equivalent signal pattern).
- Polling MUST tear down cleanly when the component is destroyed (`DestroyRef` / `takeUntilDestroyed`).

### 3.3. UI Rendering

- Each run MUST be rendered with: source label, state badge (distinct visual per state — color/icon), relative timestamp for `startedAt` (e.g., "2 minutes ago"), and a duration string if `finishedAt` is set.
- The state badge MUST distinguish `queued`, `running`, `success`, and `failed` with distinct visuals.
- The list MUST be sorted most-recent-first.
- An empty result MUST show an empty-state message (e.g., "No runs yet").

### 3.4. Auth Model

- `GET /api/pipeline/runs` SHALL follow the same auth posture as the rest of the controller (currently `@Public()`), acceptable because the panel is behind the frontend `authGuard`. **Known Risk:** same as `scraper-background-execution` — if the controller is ever exposed outside the admin shell, the public flag MUST be revisited.

## 4. Non-Functional Requirements

- The polling cadence MUST be exactly 5 000 ms (tunable via a constant; not user-configurable at runtime in this change).
- Backend queries MUST use indexed columns where possible (`source`, `startedAt`).
- The endpoint response MUST complete in < 200 ms for the default page size on a populated dataset.
- Polling MUST NOT run when the scrapers page is not visible (use Angular lifecycle cleanup) to avoid unnecessary network traffic.
- Errors during a poll MUST be retried on the next tick rather than tearing down the polling loop.

## 5. Scenarios

### 5.1. Initial load with existing terminal runs

**Given** the database contains 20 historical EtlRun rows, all in `success` or `failed`  
**When** the user navigates to `/scrapers`  
**Then** the page displays up to 50 runs ordered by `startedAt` descending  
**And** no polling timer is started (all runs terminal)

### 5.2. Polling kicks in for active runs

**Given** at least one run is in `queued` or `running`  
**When** the page is mounted  
**Then** `GET /api/pipeline/runs` is called immediately on mount and again every 5 000 ms

### 5.3. Polling stops on terminal state

**Given** polling is active  
**When** the latest poll response contains zero non-terminal runs in the visible set  
**Then** the polling timer MUST be cleared within the same effect cycle  
**And** no further HTTP requests SHALL be issued until a new trigger creates a non-terminal run

### 5.4. State transition observed between polls

**Given** a `running` run transitions to `success` between two polls  
**When** the next poll fires and resolves  
**Then** the row MUST re-render with the `success` badge and `finishedAt` populated  
**And** if no other runs are non-terminal, polling stops

### 5.5. Filter by source

**Given** the user clicks a scraper card with `id="aliexpress"` to filter the run history  
**When** the frontend issues `GET /api/pipeline/runs?source=aliexpress`  
**Then** only `aliexpress` runs are returned  
**And** the polling loop MUST consider only the filtered set when deciding to stop

### 5.6. Pagination

**Given** more than 50 runs exist for a source  
**When** the page requests runs without a `?limit`  
**Then** the backend MUST return at most 50 rows  
**And** the frontend MUST indicate that more rows exist if a `total` count is provided (out of scope to render pagination UI in this change)
