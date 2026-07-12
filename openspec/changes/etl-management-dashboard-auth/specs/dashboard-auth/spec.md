# Delta — Dashboard Auth

## Context

Only `/etl-management` is protected by JWT `authGuard`. The existing `/dashboard/*` routes remain public. This replaces the previous approach of protecting the entire dashboard subtree.

## ADDED Requirements

### Requirement: Protect /etl-management with authGuard

The route definition for `/etl-management` in `app.routes.ts` MUST add `canActivate: [authGuard]`. Unauthenticated users MUST be redirected to `/login?returnUrl=/etl-management` so that post-login the user returns to the ETL page.

#### Scenario: Unauthenticated user redirected with returnUrl

- GIVEN the user has no valid JWT token
- WHEN they navigate to `/etl-management`
- THEN they are redirected to `/login?returnUrl=%2Fetl-management`
- AND after successful login they land on `/etl-management`

#### Scenario: Authenticated user loads page directly

- GIVEN the user has a valid JWT
- WHEN they navigate to `/etl-management`
- THEN `authGuard` passes
- AND the ETL management page lazy-loads

### Requirement: /dashboard/* stays public

The parent `/dashboard` route MUST NOT have `authGuard` or `canActivate`. All existing dashboard sub-routes (resumen, analisis, encuesta) remain accessible without authentication.

#### Scenario: Dashboard accessible without login

- GIVEN an unauthenticated user
- WHEN they navigate to `/dashboard/resumen`
- THEN the dashboard loads normally
- AND no redirect to login occurs

#### Scenario: /analytics API endpoints remain public

- GIVEN an external consumer calls `GET /analytics/kpis` without JWT
- WHEN the backend receives the request
- THEN it succeeds because the endpoint is `@Public()`
