# Delta — Dashboard Shell (ETL Tab)

## Context

The dashboard shell currently shows three sidebar tabs (Resumen, Análisis, Encuesta). This change adds a fourth "Gestión ETL" tab with its lazy-loaded route.

## ADDED Requirements

### Requirement: Add ETL route to DASHBOARD_ROUTES

`DASHBOARD_ROUTES` in `dashboard.routes.ts` MUST add a child `{ path: 'etl', loadComponent: () => import('./pages/etl/etl.page') }` entry. The route MUST lazy-load the ETL page component.

#### Scenario: ETL route resolves

- GIVEN the user is authenticated and on `/dashboard/resumen`
- WHEN they navigate to `/dashboard/etl`
- THEN the Angular router loads the ETL page chunk
- AND the etl.page component renders in the `<router-outlet>`

### Requirement: Add ETL nav link in sidebar

`dashboard-shell.component.ts` MUST add an `<a routerLink="etl" routerLinkActive="active">` link in the sidebar `<nav>` with a gear icon and "ETL" label, placed after the Encuesta link.

#### Scenario: ETL tab visible in sidebar

- GIVEN the user is on any dashboard tab
- WHEN they inspect the sidebar navigation
- THEN they see four links: Resumen, Análisis, Encuesta, ETL
- AND the ETL link has `routerLink="etl"` and `routerLinkActive="active"`

#### Scenario: Active tab highlighted

- GIVEN the user clicks the ETL nav link
- WHEN the URL changes to `/dashboard/etl`
- THEN the ETL link receives the `active` CSS class
- AND previously active tab loses the `active` class

### Requirement: Existing three tabs continue to work

The resumen, analisis, and encuesta routes MUST remain functional — no route paths change, no components are removed, and their lazy chunks remain intact.

#### Scenario: Existing tab routing unaffected

- GIVEN the ETL route was added to `DASHBOARD_ROUTES`
- WHEN the user navigates to `/dashboard/resumen`
- THEN the ResumenPage chunk loads as before
- AND all existing dashboard functionality is preserved
