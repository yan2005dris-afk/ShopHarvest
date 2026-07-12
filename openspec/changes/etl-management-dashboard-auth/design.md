# Design: ETL Management Dashboard + Auth

## Technical Approach

Add 4 endpoints to the existing `PipelineController`, new lazy-loaded ETL management page with signal-based state store, SSE live streaming, and route-level auth. Mode: strict TDD (RED-GREEN-REFACTOR).

## Architecture Decisions

### Decision: Add to existing PipelineController vs new controller

| Option | Tradeoff |
|--------|----------|
| New `EtlRunController` | Separate concerns but adds module boilerplate |
| **Existing `PipelineController`** ✅ | Same route prefix `/pipeline`, shares service DI, zero new module wiring |

### Decision: SSE auth via query param

Since `JwtAuthGuard` is global (`APP_GUARD`), all new endpoints are auto-protected. SSE (`EventSource`) cannot send `Authorization: Bearer` — use `?token=` query param. Create a dedicated `SseAuthGuard` that extracts JWT from query, delegates validation to passport without affecting the global guard.

### Decision: Modify `authGuard` for returnUrl

Current guard returns `['/login']` unconditionally. Add `returnUrl` from current route tree so `LoginComponent` redirects post-auth.

### Decision: Sidebar edits in `app.html` directly

No sidebar component exists (nav is inline in `app.html`). Add ETL link with `*ngIf="authService.isAuthenticated()"` — lowest friction.

## Data Flow

```
User clicks "Ejecutar ETL"
  → ConfirmModal opens
  → POST /pipeline/etl-runs/trigger → creates RUNNING EtlRun
  → Opens EventSource to /pipeline/etl-runs/:id/stream?token=<JWT>
     → progress events (3s poll) update store.selectedRun
     → complete event → close SSE, refresh table, toast
     → onerror → fallback 5s polling
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/modules/pipeline/pipeline.controller.ts` | Modify | Add 4 endpoints (list, detail, trigger, SSE) |
| `backend/src/modules/pipeline/dto/etl-run.dto.ts` | Create | Request/response DTOs with class-validator |
| `backend/src/modules/pipeline/guards/sse-auth.guard.ts` | Create | Extract JWT from `?token=` query param |
| `frontend/src/app/app.routes.ts` | Modify | Add `/etl-management` lazy route with `authGuard` |
| `frontend/src/app/pages/etl-management/etl-management.page.ts` | Create | Page component (standalone) |
| `frontend/src/app/pages/etl-management/etl-management.store.ts` | Create | Signal-based store: runs, loading, page, filters, SSE |
| `frontend/src/app/pages/etl-management/components/*` | Create | Table, stream panel, confirm modal |
| `frontend/src/app/app.html` | Modify | Add ETL nav link with auth conditional |
| `frontend/src/app/guards/auth.guard.ts` | Modify | Add `returnUrl` to redirect URL tree |
| `frontend/src/app/pages/login/login.component.ts` | Modify | Read `returnUrl` query param on success |
| `frontend/src/app/services/auth.service.ts` | Modify | Add `getAccessToken()` for SSE token |
| `packages/contracts/src/pipeline/` | Modify | Add `EtlRunDto`, `EtlRunFiltersDto`, response DTOs |

## Interfaces / Contracts

```typescript
// New exports from @web-scraping/contracts/pipeline
export type EtlRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface EtlRunDto {
  id: string; source: string; status: EtlRunStatus;
  startedAt: string; finishedAt: string | null;
  rowsScraped: number; rowsPersisted: number;
  durationMs: number | null; errorSummary: string | null;
}

export interface EtlRunListResponseDto {
  data: EtlRunDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend (Jest) | `pipeline.controller` — 4 endpoints, auth, filters, pagination, SSE stream lifecycle | Mock `OperationalPrismaService` + `EtlSchedulerService` |
| Frontend (Vitest) | `EtlManagementStore` — loadRuns, triggerRun, SSE events, polling fallback | Mock `HttpClient`, mock `EventSource` |
| Frontend (Vitest) | `authGuard` — returnUrl redirect, unauth redirect | Angular `TestBed` |
| Frontend (Vitest) | `LoginComponent` — reads returnUrl and navigates | Angular `TestBed` |

## Threat Matrix

N/A — no routing infrastructure, shell commands, subprocesses, VCS/PR automation, executable-file classification, or process-integration boundary changes. SSE is standard HTTP streaming.

## Migration / Rollout

No migration required. New DB indexes: `@@index([source])` should be validated on `EtlRun` (currently only `@@index([status, startedAt])` exists).

## Open Questions

- [ ] Should `@@index([source])` be added to the Prisma schema for source-filter queries? Current index only covers status+startedAt
- [ ] Confirm token param name: `?token=` vs `?access_token=` vs `?jwt=`
