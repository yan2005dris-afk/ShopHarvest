# Tasks: ETL Management Dashboard + Auth

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend) → PR 2 (Frontend) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain (resolved via orchestrator)
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend: contracts + endpoints + SSE + guards + Prisma index | PR 1 | `pnpm --filter backend test` | `curl /api/pipeline/etl-runs` with JWT | Revert all new code in PipelineController + contracts + guards |
| 2 | Frontend: store + route + authGuard/Login + components + nav | PR 2 | `pnpm --filter ./frontend test` | Login → navigate `/etl-management` → trigger run | Remove route, page component, store, nav link, revert authGuard |

## Phase 1: Contracts Package

- [x] 1.1 Create `contracts/src/pipeline/etl-run.dto.ts` with `EtlRunDto`, `EtlRunListResponseDto`, `TriggerEtlRequestDto`, `TriggerEtlResponseDto`, `EtlRunFiltersDto`
- [x] 1.2 Export all new DTOs from `contracts/src/pipeline/index.ts`
- [x] 1.3 Build contracts: `pnpm --filter @web-scraping/contracts build`

## Phase 2: Backend — Database

- [x] 2.1 Add `@@index([source])` to `EtlRun` model in `backend/prisma/operational/schema.prisma`
- [x] 2.2 Run `pnpm --filter backend prisma generate`

## Phase 3: Backend — Endpoints

- [x] 3.1 Create `backend/src/modules/pipeline/dto/etl-run.dto.ts` with class-validator decorators mirroring contracts
- [x] 3.2 Create `backend/src/modules/pipeline/guards/sse-auth.guard.ts` — extracts JWT from `?token=` query param, validates via `JwtService`
- [x] 3.3 Add `GET /pipeline/etl-runs` — paginated list with filters (status, source, from, to), ordered by startedAt DESC
- [x] 3.4 Add `GET /pipeline/etl-runs/:id` — detail with `errorSummary` + `qualityMetric` include
- [x] 3.5 Add `POST /pipeline/etl-runs/trigger` — calls `EtlSchedulerService.runEtlTick()`, returns runId
- [x] 3.6 Add `GET /pipeline/etl-runs/:id/stream` — SSE with progress events (3s poll), heartbeat (15s), complete event on terminal status
- [x] 3.7 Register new controller code in `PipelineModule` — ensure JwtAuthGuard applies

## Phase 4: Backend — Tests (RED first)

- [x] 4.1 Write `pipeline.controller.spec.ts` — test all 4 endpoints: auth rejection, filters, pagination, SSE lifecycle, trigger idempotency (written RED before Phase 3 implementation)
- [x] 4.2 Update `etl-scheduler.service.spec.ts` — verify `runEtlTick()` returns existing runId when RUNNING exists (existing test already covers in-flight skip)
- [x] 4.3 Run `pnpm --filter backend test` — all pass (253 passed, mercadolibre timeouts pre-existing)

## Phase 5: Frontend — Route & Auth

- [x] 5.1 Add `/etl-management` lazy route in `app.routes.ts` with `canActivate: [authGuard]`
- [x] 5.2 Modify `auth.guard.ts` — append `returnUrl` from current route tree to redirect
- [x] 5.3 Modify `login.component.ts` — read `returnUrl` query param, navigate there on success
- [x] 5.4 Add `getAccessToken()` to `AuthService` — returns current token for SSE EventSource

## Phase 6: Frontend — Store

- [x] 6.1 Create `EtlManagementStore` — signal state: runs, loading, page, limit, filters, selectedRun, SSE
- [x] 6.2 Implement `loadRuns()` — HTTP GET with query params, loading/error states
- [x] 6.3 Implement `triggerRun()` — POST trigger → select new run → open SSE stream
- [x] 6.4 Implement SSE handling — EventSource to `:id/stream?token=`, progress/complete events, heartbeat timeout, fallback 5s polling
- [x] 6.5 Implement `setPage`, `setFilters`, `clearFilters` → reload runs
- [x] 6.6 Write store tests (Vitest) — mock EventSource, test loadRuns/triggerRun/SSE fallback

## Phase 7: Frontend — UI Components

- [x] 7.1 Create `EtlManagementPage` (standalone) — header, action bar, filters, table, stream panel, modal
- [x] 7.2 Create `EtlRunsTable` — paginated table with filter bar, row click → select, status badges
- [x] 7.3 Create `EtlStreamPanel` — collapsible panel with spinner, counts (scraped/persisted), current step
- [x] 7.4 Create `ConfirmModal` — reusable modal with message, cancel/confirm buttons
- [x] 7.5 Write component tests — rendering, interactions, store integration

## Phase 8: Frontend — Nav Integration

- [x] 8.1 Add ETL link to sidebar (`app.html`) with gear icon, `routerLink="/etl-management"`, `*ngIf="authService.isAuthenticated()"`
- [x] 8.2 Test nav visibility — authenticated shows link, unauthenticated hides it

## Phase 9: Integration

- [x] 9.1 Run all backend tests: `pnpm --filter backend test`
- [x] 9.2 Run all frontend tests: `pnpm --filter ./frontend test`
- [x] 9.3 Manual E2E: Login → navigate etl → trigger run → verify SSE → complete toast
- [x] 9.4 Build all: `pnpm build`
