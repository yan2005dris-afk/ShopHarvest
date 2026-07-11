# Spec — Scraper Background Execution

## 1. Objective

Authenticated users SHALL be able to trigger a scrape run for any backend source from `/scrapers` without blocking the UI. Runs MUST transition through `queued` → `running` → (`success` | `failed`) and the frontend MUST prevent concurrent runs for the same source. The `Run` button SHALL be disabled while any run for that source is non-terminal.

## 2. Scope

**In:**

- A `Run` action per source row that calls `POST /api/pipeline/scrape/:source`.
- Immediate UI state transition to `queued` after the HTTP response.
- Disabling the `Run` action while a run for that source is in `queued` or `running` state.
- Creation of an `EtlRun` row in PostgreSQL (`public.EtlRun`) before the HTTP response returns.
- Authorization scoped to the existing `authGuard` on the frontend shell (single-default-user model).

**Out (Non-Goals):**

- **Authentication on `POST /api/pipeline/scrape/:source`** — the endpoint is currently `@Public()`. This is acceptable for the in-scope admin panel because the trigger button only renders inside the authenticated app shell behind `authGuard`. **Known Risk:** if the same controller is ever wired into a public route or removed from behind `authGuard`, the public flag MUST be revisited. Tracked as a follow-up, not in this change.
- Showing live progress inside the browser (Playwright logs, percent, etc.). Live status is observed via run-history polling (see `etl-run-history-logs` spec).
- Cross-user concurrency control on the backend. The UI prevents accidental double-clicks; backend may serialize or run in parallel per its own implementation.

## 3. Functional Requirements

### 3.1. Trigger Action

- Clicking `Run` for a given source SHALL invoke `POST /api/pipeline/scrape/:source`.
- The HTTP request MUST be non-blocking: the user can navigate away or interact with other rows while the run is in flight.
- On a 2xx response, the UI MUST immediately reflect the new run in `queued` state using a local signal.
- The HTTP response MUST include the created `EtlRun` summary (id, state, startedAt, source).

### 3.2. Concurrency Guard at the UI

- The `Run` button for a source SHALL be disabled while any run for that source is in `queued` or `running`.
- The disabled state MUST be `computed()` from the visible EtlRun state (see `etl-run-history-logs` spec), not from an independent UI flag — this ensures correctness across poll cycles.
- After a run reaches `success` or `failed`, the button MUST automatically re-enable on the next poll.

### 3.3. Error Handling

- If the POST returns a non-2xx status or fails (network or CORS error), the UI MUST show an inline error indicator and MUST NOT mark the run as `queued`.
- The backend MUST persist the failure as an `EtlRun` row with state `failed` so the run appears in history.
- The frontend MUST NOT swallow the error: a user-visible message is mandatory.

### 3.4. Backend EtlRun Row

- The backend `PipelineService.runSource(source)` MUST write an `EtlRun` row synchronously before resolving the HTTP POST.
- The row MUST record at minimum: `source`, `state` (initially `queued` or `running`), and `startedAt`.
- A successful create MUST respond with HTTP 202 and the created `EtlRun` summary JSON.

### 3.5. Auth Model

- Authentication continues to use the existing single-default-user model (no RBAC in this change).
- Frontend gating uses the existing `authGuard`. The backend endpoint remains `@Public()` per the Out-of-Scope note above.

## 4. Non-Functional Requirements

- The POST latency from click to UI update MUST be < 1 000 ms on a local development environment.
- The frontend MUST NOT block the main thread while the scrape executes — the HTTP response MUST be returned immediately after the EtlRun row is created.
- POST SHOULD be idempotent enough that a network retry of the same trigger does not enqueue duplicate EtlRun rows; acceptable by design because the frontend disables the button the moment a request is in flight.
- Error messages MUST be human-readable and SHOULD NOT expose stack traces.

## 5. Scenarios

### 5.1. Happy path trigger

**Given** the user clicks `Run` for `mercadolibre` and no run for that source is active  
**When** `POST /api/pipeline/scrape/mercadolibre` returns 202 with the new run summary  
**Then** the UI MUST immediately mark the run as `queued`  
**And** the `Run` button becomes disabled

### 5.2. Disabled while a run is in flight

**Given** a `mercadolibre` run is in `running` state (observed via run-history polling)  
**When** the user views the row  
**Then** the `Run` button MUST be disabled  
**And** no further POST can be triggered from the UI

### 5.3. Run completes successfully

**Given** a `running` run transitions to `success` on the backend  
**When** the next poll cycle delivers the updated state to the frontend  
**Then** the `Run` button MUST be re-enabled automatically  
**And** the row MUST re-render with the `success` badge

### 5.4. Trigger network error

**Given** the user clicks `Run` and the POST fails with a network error  
**When** the catch handler runs  
**Then** the UI MUST display an inline error message  
**And** MUST NOT mark the run as `queued`  
**And** MUST NOT block subsequent `Run` attempts once the user dismisses the error

### 5.5. Backend persists EtlRun before responding

**Given** the backend receives a valid `POST /api/pipeline/scrape/aliexpress`  
**When** the controller writes an `EtlRun` row and resolves the promise  
**Then** the row MUST be visible in `GET /api/pipeline/runs` immediately after the POST resolves
