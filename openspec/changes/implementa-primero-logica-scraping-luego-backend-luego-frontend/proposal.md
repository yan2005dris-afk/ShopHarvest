# Proposal: Scraping Logic → Backend → Frontend

## Intent

Worker scrapes but never persists. Backend sends malformed messages (no selectors). Frontend has zero API wiring. Close the data flow so end-to-end scraping produces persisted products with price history visible in the UI.

## Scope

**In:** Worker POSTs results to backend; enqueueJob sends selectors; ScrapingJob model + CRUD; PriceHistory CRUD; result endpoint (upsert Product + PriceHistory); CORS, DTOs, ValidationPipe; basic scheduled scraping; frontend ApiService wired; UrlInputComponent (domain select + URL submit + results); Products list page with price history table.

**Out:** Visual mapper UI, WebSocket, auth, CSV import.

## Capabilities

### New
- `scraping-worker`: Crawlee worker that POSTs results to backend
- `scraping-scheduler`: Basic cron-like scheduled scraping
- `product-tracking`: Product + PriceHistory CRUD with upsert
- `scraping-jobs`: Job lifecycle (queued→processing→completed/failed), retries, notifications
- `url-input`: Frontend — domain selector + URL input → enqueue → results
- `product-history-ui`: Frontend — product list + price history table

### Modified
None (first real specs).

## Approach

1. **Worker**: POST result to `/api/scraping-jobs/:id/result` after scrape. Retry 3× with backoff on failure.
2. **Backend**: Fix enqueueJob — lookup DomainRule, include selectors in message. Add ScrapingJob model. Add result endpoint (validate + upsert Product + create PriceHistory). Add PriceHistory CRUD. CORS, DTOs, ValidationPipe. Schedule endpoint.
3. **Frontend**: Wire ApiService. UrlInputComponent (domain dropdown + URL + submit + results). Products list + price history page. Navigation shell.

## Affected Areas

| File | Impact |
|------|--------|
| `worker/src/consumer.ts` | Add HTTP POST after scrape |
| `backend/src/modules/scraping-jobs/` | Fix enqueueJob, add result endpoint, job CRUD |
| `backend/src/modules/products/` | Add PriceHistory CRUD |
| `backend/src/main.ts` | CORS, ValidationPipe |
| `backend/prisma/schema/` | Add ScrapingJob model |
| `frontend/src/app/services/api.service.ts` | All endpoint methods |
| `frontend/src/app/pages/url-input/` | Form logic + API |
| `frontend/src/app/pages/` | New products list page |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| POST fails, data lost | Med | Retry 3× with backoff, notify on final failure |
| Duplicate products | High | Upsert by `productUrl` |
| Backend down during scrape | Low | Retries; event-driven later if needed |

## Rollback Plan

Per-phase revert. Phase 1 is backward-compatible (backend ignores unknown POSTs). Phase 2 revert migration + code. Phase 3 cosmetic — no data impact.

## Dependencies

- RabbitMQ reachable (docker-compose)
- Backend API reachable from worker (same network)
- Prisma migration for ScrapingJob

## Success Criteria

- [ ] Worker scrapes → backend persists Product + PriceHistory
- [ ] `GET /products` returns products with history
- [ ] Frontend URL input → enqueue → shows results
- [ ] Failed scrape retries 3×, marks job failed
- [ ] All phases deployable in existing docker-compose
