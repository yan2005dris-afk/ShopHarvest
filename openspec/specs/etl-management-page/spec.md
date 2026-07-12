# ETL Management Page

## Purpose

ETL management UI providing a filterable runs table, manual trigger with confirmation, live progress via SSE, and automatic polling fallback on error.

## Requirements

### Requirement: Filterable runs table with pagination

The page MUST load runs on mount using current filters and page. Filter changes MUST reset to page 1. Pagination MUST preserve filters. Columns: ID (8 chars), Source, Status (badge), Started At, Finished At, Duration, Scraped, Persisted, Error (tooltip), Actions.

#### Scenario: Mount loads latest 20 runs

- GIVEN the user navigates to `/etl-management` with valid JWT
- WHEN the page loads
- THEN `GET /api/pipeline/etl-runs?page=1&limit=20` fires
- AND the table renders 20 rows with status badges

#### Scenario: Filter change resets to page 1

- GIVEN the user is on page 2 with limit=20
- WHEN they select `status=FAILED` in the filter bar
- THEN `GET /api/pipeline/etl-runs?page=1&limit=20&status=FAILED` fires

#### Scenario: Pagination preserves filters

- GIVEN the filter `status=SUCCESS` is active
- WHEN the user clicks page 2
- THEN `GET /api/pipeline/etl-runs?page=2&limit=20&status=SUCCESS` fires

### Requirement: Manual trigger with confirmation

"Ejecutar ETL" button MUST open a confirmation modal. On confirm, `POST /api/pipeline/etl-runs/trigger`. On success, select the new run and open SSE stream.

#### Scenario: Trigger creates run and starts SSE

- GIVEN the user clicks "Ejecutar ETL" and confirms
- WHEN the POST returns `{ runId: "abc-123", status: "RUNNING" }`
- THEN the new run appears selected in the table
- AND the SSE stream to `/api/pipeline/etl-runs/abc-123/stream` opens

### Requirement: Live SSE progress panel

While a RUNNING run is selected, a collapsible panel MUST show live progress: current step, rows scraped, rows persisted, and a spinner. SSE events update `selectedRun` in the store.

#### Scenario: SSE updates progress in real-time

- GIVEN the SSE stream is open for a RUNNING run
- WHEN a `progress` event arrives with `rowsScraped=42`
- THEN the streaming panel updates to show "Scrapeando: 42 items"

### Requirement: SSE → polling fallback on error

If the SSE connection errors or closes before the `complete` event, the frontend MUST fall back to polling `GET /api/pipeline/etl-runs/:id` every 5 seconds.

#### Scenario: SSE fails, polling takes over

- GIVEN an SSE connection that drops unexpectedly
- WHEN the `EventSource.onerror` fires
- THEN the store switches to polling the run ID every 5s
- AND the polling stops when the run reaches a terminal state

### Requirement: Terminal state closes SSE and refreshes

On receiving a `complete` event (SUCCESS/FAILED), the frontend MUST close the SSE, refresh the runs list, and show a toast with the result.

#### Scenario: Run completes successfully

- GIVEN a RUNNING run with active SSE
- WHEN a `complete` event with `status=SUCCESS` arrives
- THEN the SSE connection closes
- AND the runs list refreshes
- AND a success toast appears

### Requirement: Error expandable on row click

Clicking a FAILED row MUST expand an inline detail showing the `errorSummary`. A second click collapses it.

#### Scenario: Expand error detail

- GIVEN a row with `status=FAILED`
- WHEN the user clicks the row
- THEN an expanded section shows the error summary
- WHEN they click again
- THEN the section collapses
