# Proposal: Multi-Scraper Menus and Control Panel

## Intent
Provide a unified, secure administrative dashboard in the frontend to manage, execute, and monitor the 7 defined backend scrapers (MercadoLibre, AliExpress mock, Temu, Shein, Exchange Rates, CSV Dataset, and Google Forms Survey). It will also allow filtering the scraped products table by origin and type, and monitor executions in the background via run history logs without blocking the UI.

## Scope
### In Scope
- **"Scrapers Definidos" Panel**: Authenticated navigation route `/scrapers` displaying the active scrapers list.
- **Background Execution & Monitoring**: Asynchronous run triggers that transition logs through states (`queued` -> `running` -> `success` / `failed`) without locking the UI.
- **Unified Products Table Filters**: Filters for "Origin" and "Product Type" on `/products`, populated dynamically and reactively.
- **Access Control**: Restrict the `/scrapers` route to the single default authenticated user using the existing `authGuard`.

### Out of Scope
- **Scraper Scheduling/Cron UI**: Changing scrape schedules dynamically from the UI.
- **User Role Management**: Implementing complex RBAC.
- **Scraper Code Editor**: Visual selector mapping or editing scraper code in the browser.

## Capabilities
### New Capabilities
- `scrapers-defined-list`: Fetch and display active backend scraping sources dynamically.
- `scraper-background-execution`: Trigger scraping jobs in the background, updating state asynchronously.
- `etl-run-history-logs`: Display execution history states and execution timestamps in a list.
### Modified Capabilities
- `products-unified-filtering`: Filter products listing table by Origin (source) and Product Type (category).

## Approach
- **Frontend Service**: Add/update `PipelineService` with `inject(HttpClient)` to handle scraping endpoints and fetch run execution logs.
- **Dynamic Routing**: Add the `/scrapers` route to `app.routes.ts` protected by `authGuard` and link it in the sidebar navigation.
- **Asynchronous Execution UI**: Use Angular signals (`signal`, `computed`, and `effect` for status checks) to manage background state and poll execution logs.
- **Products Component**: Update template and controller to parse query parameters (`source` and `type`) and filter database queries.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/services/pipeline.ts` | New | Services to connect frontend to `/api/pipeline/...` endpoints. |
| `frontend/src/app/app.routes.ts` | Modified | Register `/scrapers` under `authGuard`. |
| `frontend/src/app/app.ts` & `app.html` | Modified | Add "Scrapers Definidos" sidebar item. |
| `frontend/src/app/pages/scrapers/` | New | Standalone components for managing scrapers and viewing execution logs. |
| `frontend/src/app/pages/products/` | Modified | Reactive filters for "Origin" and "Product Type". |
| `backend/src/modules/pipeline/` | Modified | Implement or expose `GET /api/pipeline/runs` query to fetch background execution logs. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Server Overload**: Running heavy Playwright processes concurrently. | Medium | Disable the "Run" button in the UI for running sources. Limit concurrent jobs on backend. |
| **Out of Sync Logs**: UI displays outdated run states. | Low | Implement short-interval polling (e.g., 5s) while jobs are in `queued` or `running` state. |

## Rollback Plan
Revert frontend and backend commits. DB schema has no changes since we use `public.EtlRun` and `public.Product`.

## Dependencies
- Backend `/api/pipeline/sources` and `/api/pipeline/scrape/:source` must be functional.
- PostgreSQL tables `public.EtlRun` and `public.Product` must be accessible.

## Success Criteria
- [ ] Scrapers are listed dynamically under the authenticated "Scrapers Definidos" menu.
- [ ] Users can trigger a scraper and see updates (`queued` -> `running` -> `success` / `failed`) in the background log history.
- [ ] The products page filters correctly by source and product type.
