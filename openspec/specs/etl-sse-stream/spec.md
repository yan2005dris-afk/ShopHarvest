# ETL SSE Stream

## Purpose

Provide real-time ETL run progress updates via Server-Sent Events, with heartbeat to prevent proxy idle timeout and guaranteed close on terminal state.

## Requirements

### Requirement: SSE endpoint delivers real-time events

The backend MUST expose `GET /api/pipeline/etl-runs/:id/stream` returning `text/event-stream`. It emits `progress` events as the run advances and a `complete` event when the run reaches SUCCESS or FAILED. Connection MUST close automatically after `complete`.

| Event | Payload | Trigger |
|-------|---------|---------|
| `progress` | `{ runId, status: "RUNNING", rowsScraped, rowsPersisted, currentStep }` | Every ~2-5s while RUNNING |
| `complete` | `{ runId, status: "SUCCESS"|"FAILED", rowsScraped, rowsPersisted, durationMs, errorSummary? }` | Status transitions to terminal |

#### Scenario: Live progress then completion

- GIVEN a RUNNING ETL run with ID `abc-123`
- WHEN the user opens `GET /api/pipeline/etl-runs/abc-123/stream` with valid auth
- THEN they receive periodic `progress` events with increasing `rowsScraped` and `rowsPersisted`
- WHEN the run finishes
- THEN a `complete` event fires with `status=SUCCESS`
- AND the SSE connection closes

### Requirement: Immediate terminal for already-finished runs

If the requested run is already in a terminal state (SUCCESS/FAILED), the endpoint MUST emit the `complete` event immediately and close.

#### Scenario: Connect to completed run

- GIVEN a run with `status=SUCCESS`
- WHEN the SSE endpoint opens
- THEN `complete` event fires within 500ms
- AND the connection closes

### Requirement: Heartbeat to prevent proxy timeout

The endpoint MUST emit an SSE `: heartbeat` comment event every 15 seconds while the run is still RUNNING, to prevent Render's 30s idle proxy timeout.

#### Scenario: Heartbeat keeps connection alive

- GIVEN a RUNNING run and an active SSE connection
- WHEN 15+ seconds pass without a `progress` event
- THEN a `: heartbeat` comment event is received
- AND the connection remains open

### Requirement: Auth via query param or cookie

Since `EventSource` API doesn't send custom headers, the endpoint MUST accept JWT via query param (`?token=`) or cookie as fallback, in addition to the standard `Authorization` header.

#### Scenario: EventSource connects with token query param

- GIVEN the frontend creates `new EventSource('/api/pipeline/etl-runs/abc-123/stream?token=...')`
- WHEN the backend validates the token
- THEN the SSE connection opens
- AND events begin flowing

### Requirement: Graceful client disconnect

The server MUST detect client disconnection and clean up the SSE listener to avoid resource leaks.

#### Scenario: Client navigates away

- GIVEN an active SSE connection monitoring a RUNNING run
- WHEN the user navigates to a different page (client closes connection)
- THEN the backend detects the disconnect
- AND cancels the interval emitting events for that run
