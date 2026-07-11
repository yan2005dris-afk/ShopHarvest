## Exploration: multi-scraper-menus

### Current State

The codebase currently contains a functional multi-scraper backend and a static frontend dashboard. However, there is no direct mechanism in the frontend to trigger specific scraper runs or view products filtered by scraper source.

#### Backend Scraper Setup
- **Supported Sources**: The backend defines 7 distinct sources in the canonical `PipelineSource` enum (see [pipeline.source.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/packages/contracts/src/pipeline/pipeline.source.ts)):
  1. `mercadolibre` (MercadoLibre Ecuador — scraping via Playwright)
  2. `aliexpress` (AliExpress — scraping via Playwright targeting books.toscrape.com mock)
  3. `temu` (Temu — extension-based extraction)
  4. `shein` (Shein — extension-based extraction)
  5. `api_rates` (Exchange Rates API consumer)
  6. `csv_dataset` (CSV Dataset loader)
  7. `encuesta` (Google Forms survey CSV loader)
- **Architecture**: 
  - Each source corresponds to a NestJS adapter under `backend/src/modules/pipeline/adapters/data-sources/` that references actual extraction logic in `backend/pipeline/scripts/scraping/`.
  - Runs are orchestrated by the `PipelineService` (see [pipeline.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/pipeline.service.ts)).
  - Executed scraper results flow to raw files → staging folder → Data Warehouse (`dw.*` schema in PostgreSQL). Run summaries are logged in the `public.EtlRun` table.
- **REST Endpoints**: Under `/api/pipeline/` (see [pipeline.controller.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/pipeline.controller.ts)):
  - `GET /sources` — returns the list of available sources.
  - `POST /scrape/:source` — runs a single scraper.
  - `POST /staging` — runs raw-to-staging transforms.
  - `POST /load-dw` — loads staged data into the DW.
  - `POST /run-all` — triggers full ETL pipeline.

#### Frontend Routing and Menu Structure
- **Main App Shell** (defined in [app.routes.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/frontend/src/app/app.routes.ts) and [app.html](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/frontend/src/app/app.html)):
  - Main app navigation is hardcoded in the sidebar:
    - **Visual Mapper** (`/`) — Entering a URL to visually map columns using the Chrome extension.
    - **Products** (`/products`) — Listing all operational products (reads `public.Product` table).
    - **Extension** (`/setup`) — Installation guides for the browser extension.
  - This shell is protected by the `authGuard`.
- **BI Dashboard Shell** (defined in [dashboard.routes.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/frontend/src/app/pages/dashboard/dashboard.routes.ts) and [dashboard-shell.component.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/frontend/src/app/pages/dashboard/layout/dashboard-shell.component.ts)):
  - Lazily loaded under `/dashboard`.
  - Open public BI dashboard navigation links:
    - **Resumen** (`/dashboard/resumen`)
    - **Análisis** (`/dashboard/analisis`)
    - **Encuesta** (`/dashboard/encuesta`)
  - No auth guard is applied here (intentional public access).

### Affected Areas

| File | Why Affected |
|------|-------------|
| `frontend/src/app/services/pipeline.service.ts` | **New File**: Service to connect frontend UI with the backend `/api/pipeline/...` endpoints (sources, trigger-scrape, staging, load-dw, and run-all). |
| `frontend/src/app/app.routes.ts` | Register the new `/scrapers` route under the `authGuard`. |
| `frontend/src/app/app.html` & `app.ts` | Add a navigation item "Scrapers Control" or "Scrapers Studio" in the main sidebar. |
| `frontend/src/app/pages/scrapers/` | **New Folder**: Contain `scrapers.ts` and `scrapers.html` implementing a unified Control Panel for managing, executing, and listing scrapers dynamically. |
| `frontend/src/app/pages/products/products.component.ts` & `.html` | Modify to read optional `source` query parameters (e.g. `/products?source=aliexpress`) to filter products list accordingly. |
| `backend/src/modules/pipeline/pipeline.controller.ts` & `.service.ts` | Add a `GET /runs` endpoint to return last executions of `EtlRun` so the control panel can display the runtime status (Success/Failed/Running) and timestamps. |

### Approaches

#### 1. Static Sidebar Navigation Sub-links (Direct Routes)
Add hardcoded links for each scraper (MercadoLibre, AliExpress, Temu, Shein) directly in the main app shell sidebar or a new collapsible section.
- **Pros**: Direct one-click access to each scraper.
- **Cons**: High maintenance. If a new scraper is added to the backend (e.g., Amazon, Shopee), frontend routing, sidebars, and components must be updated. Clutters the sidebar.
- **Effort**: Medium-High.

#### 2. Unified "Scrapers Control Panel" (Dynamic Metadata-driven)
Create a single route `/scrapers` (Sidebar: "Scrapers Studio") that dynamically queries the backend `/api/pipeline/sources` endpoint to fetch supported scrapers. It lists them in a grid, showing run history, last execution states, and buttons to trigger individual runs or view the respective products.
- **Pros**: 
  - Zero-maintenance frontend. Adding a new source to the backend `PipelineSource` enum automatically reflects in the frontend.
  - Keeps the sidebar clean.
  - Security: Keeps control triggers inside the authenticated main app shell (behind `authGuard`), preventing public dashboard users from executing scrapers.
- **Cons**: Requires one extra click to navigate to the control page first.
- **Effort**: Low-Medium.

#### 3. Dashboard Integration (Public Access Tab)
Place the scraper triggers and status page inside the public BI dashboard under `/dashboard/scrapers`.
- **Pros**: Co-locates DW loading controls with the analytics pages.
- **Cons**: **Security Risk**. Since the BI dashboard is public and bypasses the `authGuard` (per spec design), exposing administrative features like triggering scrapers or executing database loads to unauthenticated users is highly insecure.
- **Effort**: Medium.

### Recommendation

**Approach 2 (Unified Scrapers Control Panel under authentication)** is recommended.
- It keeps the user interface secure and clean, separating public business intelligence displays from administrative control features.
- It is dynamic and respects a single source of truth (the backend `PipelineSource` enum via `/api/pipeline/sources`).
- It integrates nicely with the products page via query parameters (`/products?source=aliexpress`), avoiding the need to duplicate product list views.

### Risks
- **Concurrency Overload**: Running heavy Playwright scrapers concurrently from the UI could choke the server. The backend `PipelineService.runAll` executes them in parallel; we should ensure the frontend UI disables run buttons when a run is in progress.
- **User Permissions**: Ensure the endpoint `POST /api/pipeline/scrape/:source` is guarded if user permissions are introduced in the future, even though the analytics controller is public. Currently, `PipelineController` is `@Public()`, but it should eventually be authenticated if exposed in a production admin panel.

### Ready for Proposal
**Yes** — The code structure, backend adapter dependencies, and routing layouts have been analyzed. The proposal can proceed.
