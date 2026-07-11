# Spec — Scrapers Defined List

## 1. Objective

The frontend SHALL fetch the list of active backend scraping sources from the canonical backend endpoint and render them in an authenticated, dynamic control panel at `/scrapers`. Adding a new source on the backend MUST be reflected in the UI without any frontend code changes.

## 2. Scope

**In:**

- Calling `GET /api/pipeline/sources` from the frontend over HTTP.
- Rendering the source list in a standalone Angular component under `frontend/src/app/pages/scrapers/`.
- Registering the `/scrapers` route under the existing `authGuard`.
- Adding a sidebar navigation entry labeled "Scrapers Definidos" in the main authenticated app shell (`frontend/src/app/app.html`).

**Out:**

- Editing, persisting, or scheduling scraper definitions from the UI.
- Role-based access control beyond the existing `authGuard` (single-default-user model).
- Public/unauthenticated access to the control panel.

## 3. Functional Requirements

### 3.1. Source Listing Fetch

- The frontend `PipelineService` SHALL expose a method that calls `GET /api/pipeline/sources` and returns the list of supported sources.
- Each item MUST carry at minimum: `id` (string identifier matching the backend `PipelineSource` enum), `label` (human-readable name), and `description` (one-line summary).
- The list MUST be presented in the order returned by the backend; the frontend MUST NOT reorder sources client-side in this change.

### 3.2. Frontend Component

- The control panel MUST be an Angular standalone component using the `inject()` function (no NgModules).
- The list state MUST be held in a `signal<Source[]>`; derived view states (loading, error, empty, ready) MUST be expressed with `computed()`.
- The component SHALL render each source as a row/card showing the source label, description, last-run state summary, and a `Run` action.
- Change detection MUST be `OnPush` to avoid unnecessary re-renders.

### 3.3. Route Registration

- The `/scrapers` route SHALL be registered in `frontend/src/app/app.routes.ts` and protected by `authGuard`.
- The route MUST be lazy-loaded to avoid bloating the main bundle.
- A sidebar entry titled "Scrapers Definidos" SHALL be added in `frontend/src/app/app.html` and linked to `/scrapers`.

### 3.4. Dynamic, Zero-Maintenance Source Set

- The frontend MUST NOT hardcode any source identifier, label, or description. All metadata MUST come from the backend response.
- When a new source is added to the backend `PipelineSource` enum (and exposed via `/api/pipeline/sources`), the frontend MUST render it on next load without any frontend code change.

## 4. Non-Functional Requirements

- Initial load of the source list SHALL be non-blocking; the UI MUST render an explicit loading state until the HTTP request resolves.
- HTTP errors MUST be surfaced to the user (inline error indicator), not swallowed.
- The component MUST use `OnPush` change detection to avoid unnecessary re-renders.
- The component MUST cancel in-flight requests on destroy (`DestroyRef` + `takeUntilDestroyed` or RxJS `takeUntilDestroyed`) to avoid stale updates.

## 5. Scenarios

### 5.1. Initial load with sources returned

**Given** the backend returns the 7 sources from `/api/pipeline/sources`  
**When** the authenticated user navigates to `/scrapers`  
**Then** the page renders one row per source with label and description visible  
**And** a `Run` action is rendered for each source

### 5.2. Unauthenticated user is redirected

**Given** the user has no valid session  
**When** they navigate to `/scrapers`  
**Then** `authGuard` MUST redirect them to the login page  
**And** no `GET /api/pipeline/sources` request is made

### 5.3. Empty source list

**Given** the backend returns `{ sources: [] }`  
**When** the page loads  
**Then** the UI MUST display an explicit empty-state message (e.g., "No scrapers configured")

### 5.4. Backend error on sources fetch

**Given** `/api/pipeline/sources` returns HTTP 500  
**When** the page loads  
**Then** the UI MUST display a non-blocking error indicator  
**And** the user SHALL be able to retry the request without reloading the page

### 5.5. Backend adds a new source without frontend changes

**Given** the backend `PipelineSource` enum gains a new value (e.g., `amazon`)  
**When** the backend redeploys and the frontend reloads `/scrapers`  
**Then** the new source MUST appear in the UI automatically without any frontend code change
