# Proposal: ETL Management Dashboard + Auth

## Intent

Add an ETL management page with live progress streaming (SSE) and manual trigger capability. Keep existing `/dashboard` public but protect the new `/etl-management` route with JWT auth. Expose REST + SSE endpoints for run history, detail, trigger, and real-time progress.

## Scope

### In Scope
- 4 new endpoints in `PipelineController`: `GET /pipeline/etl-runs` (paginated), `GET /pipeline/etl-runs/:id`, `POST /pipeline/etl-runs/trigger`, `GET /pipeline/etl-runs/:id/stream` (SSE)
- New lazy-loaded route `/etl-management` with table, filters, pagination, trigger modal, SSE progress panel
- `authGuard` on `/etl-management` route only; redirect to `/login?returnUrl=/etl-management`
- Nav link "ETL" in sidebar (visible when authenticated)
- New DTOs in `@web-scraping/contracts/pipeline`

### Out of Scope
- Pipeline rewrite with message queue / streaming batches
- Real-time scraper progress (individual source status)
- ETL scheduling UI (cron editor)
- Historical trend charts for ETL performance

## Capabilities

### New Capabilities
- `etl-run-management`: Full CRUD + SSE streaming for ETL runs — list, detail, manual trigger, live progress
- `etl-auth-guard`: Route-level JWT protection for ETL management page with returnUrl redirect

### Modified Capabilities
- `pipeline-scheduler`: Expose `runEtlTick()` for manual trigger; SSE endpoint reuses existing idempotency check
- `dashboard-shell`: Add "ETL" nav link (conditionally rendered)

## Approach

**Backend**: Add `PipelineController` in `backend/src/modules/pipeline/` with 4 endpoints. Use `@Sse()` from `@nestjs/common` for streaming. Reuse `EtlSchedulerService.runEtlTick()` for trigger (already handles RUNNING check). Return `EtlRun` DTOs with computed `durationMs`. Heartbeat comment event every 15s to keep Render proxy alive.

**Frontend**: New `EtlManagementPage` at `frontend/src/app/etl-management/` (lazy-loaded). `EtlManagementStore` with signals: `runs`, `loading`, `page`, `filters`, `selectedRun`, `sseConnection`. On trigger → create `EventSource` to SSE endpoint; `progress` events update `selectedRun`; `complete` event closes SSE, refreshes list, shows toast. Fallback: 5s polling on error/close.

**Auth**: Keep `/dashboard` public. Add `canActivate: [authGuard]` to `/etl-management` route. `LoginComponent` already handles `returnUrl` param.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/modules/pipeline/pipeline.controller.ts` | New | 4 endpoints (list, detail, trigger, SSE) |
| `backend/src/modules/pipeline/dto/` | New | DTOs: `EtlRunDto`, `EtlRunListResponseDto`, `TriggerEtlResponseDto`, `EtlRunFiltersDto` |
| `backend/src/modules/pipeline/etl-scheduler.service.ts` | Modified | Expose `runEtlTick()` for trigger |
| `frontend/src/app/etl-management/` | New | Page, store, components (table, filters, modal, SSE panel) |
| `frontend/src/app/app.routes.ts` | Modified | Add `/etl-management` route with `authGuard` |
| `frontend/src/app/core/layout/sidebar/` | Modified | Add "ETL" nav link (auth-gated) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SSE fails behind Render proxy (30s idle timeout) | Medium | Heartbeat comment event every 15s; fallback 5s polling |
| Long-running ETL (>30s) → browser timeout | Low | SSE keeps connection alive; no request timeout on streaming endpoint |
| Concurrent manual triggers | Low | `EtlSchedulerService.runEtlTick()` already checks for RUNNING run |
| Large run history perf | Low | Pagination + indexes on `status, startedAt` exist |

## Rollback Plan

1. Remove `/etl-management` route and `authGuard` from `app.routes.ts`
2. Delete `frontend/src/app/etl-management/`
3. Remove "ETL" nav link from sidebar
4. Remove `PipelineController` endpoints
5. Delete DTOs in `@web-scraping/contracts/pipeline`
6. Revert `EtlSchedulerService` trigger exposure
7. No DB migration needed (read-only + existing `EtlRun`)

## Dependencies

- Backend: `@nestjs/common` (`@Sse`), `cron-parser` (via `@nestjs/schedule`), existing `EtlSchedulerService`, `OperationalPrismaService`
- Frontend: Angular 22 router, signals, HTTP client, existing `authGuard`, `LoginComponent`
- Contracts: New DTOs in `@web-scraping/contracts/pipeline`

## Success Criteria

- [ ] Authenticated user visits `/etl-management` → sees paginated run table with filters
- [ ] User filters by status "FAILED" → server-side filter applied
- [ ] User clicks "Ejecutar ETL" → confirms modal → new run appears with RUNNING status
- [ ] While RUNNING, SSE panel shows live progress (scraped/persisted counts)
- [ ] Run completes → SSE closes, toast shows result, table refreshes
- [ ] Unauthenticated user visits `/etl-management` → redirect to `/login?returnUrl=/etl-management` → post-login returns to ETL page
- [ ] Authenticated user sees "ETL" link in sidebar