## Exploration: Implement scraping logic → backend logic → frontend

### Current State

#### Worker (Scraping) — Almost Functional
- **consumer.ts**: Fully functional RabbitMQ consumer. Connects to `scraping-jobs` queue, prefetch=1, auto-reconnect, graceful shutdown. Parses JSON messages into `ScrapingJob` type. Validates required fields (url, selectors.title, selectors.price). Calls `scrapeUrl()`.
- **scraper.ts**: Fully functional Crawlee `PlaywrightCrawler`. Extracts data using CSS or XPath selectors. Price parser handles European (1.234,56) and US ($1,234.56) formats. Currency detector recognizes USD, EUR, ARS, BRL, GBP, CLP, MXN, COP, PEN.
- **types.ts**: Defines `ScrapingJob`, `ScrapedData`, `DomainRule` interfaces.
- **CRITICAL GAP**: Worker scrapes but **never persists results**. Line 105 says `// ── Future: persist result via Prisma ──` but has no DB write. Has `@prisma/client` in dependencies but unused.
- **MESSAGE FORMAT MISMATCH**: Worker expects `{ jobId, url, domainRuleId, selectors: { title, price, image?, sku? }, selectorType }` but backend sends `{ domainRuleId, url, timestamp }` — they don't align.

#### Backend (NestJS) — Scaffolding with Gaps
- **DomainRules** (`/domains`): Full CRUD implemented — GET, POST, GET/:id, PATCH/:id, DELETE/:id.
- **Products** (`/products`): GET all, GET/:id, GET/domain/:domainRuleId, POST (typed as `Record<string,unknown>` with `as any` cast), DELETE/:id.
- **ScrapingJobs** (`/scraping-jobs`): POST (enqueue) sends `{ domainRuleId, url, timestamp }` to RabbitMQ but doesn't include selectors. GET /status returns queue info.
- **RabbitMQ Module**: Just a ConfigModule wrapper — no shared service. Each module creates its own AMQP connection.
- **PriceHistory**: Schema exists, migration exists, but NO controller or service.
- **No CORS**: `main.ts` has no CORS configuration.
- **No DTOs/Validation**: Body types are inline, Products POST uses `as any`.
- **Prisma**: Schema has 3 models with proper relations and indexes. Migration applied. Adapter uses `@prisma/adapter-pg`.

#### Frontend (Angular) — Static Scaffolding
- **App shell**: RouterOutlet only, still shows default Angular welcome template.
- **Routes**: `/url-input` and `/visual-mapper` registered.
- **api.service.ts**: Has `HttpClient` + `baseUrl = '/api'` but **ZERO methods**.
- **UrlInputComponent**: Static HTML form with URL input + "Iniciar Scraping" button. No `ngModel`, no event handlers, no API calls.
- **VisualMapperComponent**: Empty component with static layout (sidebar + iframe placeholder).
- **Proxy**: `proxy.conf.json` proxies `/api` → `localhost:3000`.

### Data Flow Gap

```
USER → Frontend URL Input
         → POST /api/scraping-jobs { domainRuleId, url }
           → Backend sends { domainRuleId, url, timestamp } → RabbitMQ
             → Worker receives { domainRuleId, url, timestamp }
               → CAN'T scrape (missing selectors)
               → CAN'T persist results (no DB write)
```

### Affected Areas

| File | Why Affected |
|------|-------------|
| `worker/src/consumer.ts` | Must enrich message with selectors from DB, or backend must send them. Must persist results after scrape. |
| `worker/src/scraper.ts` | Minor: possibly add pagination support, better error handling. Core logic is done. |
| `worker/src/types.ts` | May need adjustments to match backend ScrapingJob model. |
| `worker/src/index.ts` | **Does not exist**. Need entry point for worker bootstrap (consumer.ts is currently the entry). |
| `worker/package.json` | Already has `@prisma/client` — just needs to be wired. |
| `backend/src/main.ts` | Add CORS, possibly global validation pipe. |
| `backend/src/modules/scraping-jobs/scraping-jobs.service.ts` | Must fetch DomainRule selectors and include them in the RabbitMQ message. Must handle result callback or polling. |
| `backend/src/modules/scraping-jobs/scraping-jobs.controller.ts` | Add GET endpoint to list jobs, support result retrieval. |
| `backend/src/modules/products/products.controller.ts` | Add price history endpoints. |
| `backend/src/modules/products/products.service.ts` | Add price history CRUD. |
| `backend/src/common/rabbitmq/` | Needs a proper `RabbitmqService` for publish/consume (currently just config). |
| `backend/prisma/schema/` | Add ScrapingJob model if we want to track job state in DB. |
| `frontend/src/app/services/api.service.ts` | Add methods: getDomains, enqueueJob, getProducts, getJobStatus. |
| `frontend/src/app/pages/url-input/` | Add form logic, domain selection, API call, results display. |
| `frontend/src/app/pages/visual-mapper/` | Needs the iframe + selector picker logic. |
| `frontend/src/app/app.html` | Replace Angular welcome template with nav + router-outlet. |
| `frontend/src/app/app.ts` | Add navigation links, potentially a shared layout. |

### Approaches

#### Approach 1: Worker writes directly to DB (simplest, breaks DDD)
Worker has Prisma client, scrapes, then writes Product + PriceHistory directly to PostgreSQL. Backend just reads results.

- **Pros**: Simplest data flow. No additional API calls. Works offline. Fastest to implement.
- **Cons**: Worker needs DB credentials (already has them in env). Tight coupling to schema. Worker becomes a DB writer violating separation of concerns. Harder to add validation/business logic.
- **Effort**: Low (worker already has `@prisma/client`)

#### Approach 2: Worker calls backend API to save results (cleaner)
Worker scrapes, then POSTs results back to backend `/api/products` (or a dedicated `/api/scraping-jobs/:id/result` endpoint). Backend validates and persists.

- **Pros**: Single source of truth for business logic. Backend validates + creates PriceHistory automatically. Clean separation. Worker stays a scraper only.
- **Cons**: Extra HTTP call per scrape. Worker needs backend URL configured. Backend must be available.
- **Effort**: Medium (add API endpoint + HTTP client in worker)

#### Approach 3: Full event-driven with result queue (most decoupled)
Worker scrapes, then publishes result to a `scraping-results` queue. Backend consumes results and persists them. Fully async, no direct coupling.

- **Pros**: Maximum decoupling. Backend can be down during scrape. Retry/replay via queue. Follows existing event-driven pattern.
- **Cons**: More moving parts. Need to declare second queue. Slightly more complex to debug.
- **Effort**: Medium-High (add result queue, result consumer in backend, wire everything)

### Recommendation

**Approach 2 (Worker calls backend API)** is the best balance for this project's current state:

1. **Phase 1 — Worker**: Already 90% done. Add HTTP call to POST results to backend. This is minimal code (fetch or axios) and doesn't require Prisma in the worker.
2. **Phase 2 — Backend**: Fix `enqueueJob()` to fetch DomainRule selectors and include them in the message. Add a dedicated `POST /scraping-jobs/:id/result` endpoint that validates scraped data, creates Product + PriceHistory, and updates job status. Add a `ScrapingJob` model to Prisma to track job lifecycle (queued → processing → completed/failed).
3. **Phase 3 — Frontend**: Wire up `ApiService` with all endpoints. Build UrlInputComponent with domain selector + URL input + result display. Add a products list page. Add navigation.

**Why not Approach 1**: The project architecture (NestJS backend + Prisma) clearly intends the backend to be the data authority. Having the worker write directly to the same tables bypasses validation and creates two paths to data mutation.

**Why not Approach 3**: Adds complexity (second queue, result consumer) that isn't justified yet. The worker already has HTTP access to the backend in the docker-compose network. Can evolve to this later if needed.

### Implementation Order

```
Phase 1: Worker (Scraping Logic)
├── Add result submission to backend API after scrape
├── (scraper.ts is already functional — minimal changes)
└── Actual effort: ~1 file change in consumer.ts

Phase 2: Backend Logic
├── Fix enqueueJob to include selectors in message
├── Add ScrapingJob model to Prisma (track job state)
├── Add POST /scraping-jobs/:id/result endpoint
├── Add PriceHistory CRUD
├── Enable CORS
├── Add DTOs + validation pipes
└── Actual effort: ~6 files

Phase 3: Frontend UI
├── Build ApiService methods (getDomains, enqueueJob, getProducts)
├── Implement UrlInputComponent with domain selection + submit + results
├── Keep VisualMapperComponent as placeholder for future
├── Add products list page
├── Replace Angular default template with nav + layout
└── Actual effort: ~6 files
```

### Key Sequence for enqueueJob Fix

Current: `POST /scraping-jobs { domainRuleId, url? }`
1. Backend looks up DomainRule by ID
2. Generates a UUID for the job
3. Creates ScrapingJob record in DB (status=queued)
4. Sends message: `{ jobId, url, domainRuleId, selectors: { title, price, image, sku }, selectorType }`
5. Worker receives → scrapes → POSTs result back to `/api/scraping-jobs/{jobId}/result`
6. Backend receives result → creates Product + PriceHistory → updates job status=completed

### Risks

- **Message format mismatch is blocking**: The first thing to fix. No scraping works until the backend sends selectors.
- **No error handling for downstream failures**: If the backend is down when the worker finishes, scraped data is lost (with Approach 2). Solution: add retry logic in worker or buffer results.
- **Duplicate products**: Worker could scrape the same URL twice. Need upsert logic in backend (match by `productUrl` or `externalId`).
- **Worker has no `index.ts`**: Currently `consumer.ts` is the entry. This works but is unconventional. Adding one is trivial.
- **No Prisma generation for worker**: Worker has `@prisma/client` in deps but may need `prisma generate` to use it (if we go with Approach 1).

### Ready for Proposal
**Yes** — the analysis is complete. The gaps are clear, the approaches are compared, and the recommendation is ready. The orchestrator should tell the user:

> "The exploration is done. The worker scraper is 90% complete (just needs result persistence), the backend has all the CRUD scaffolding but needs the message format fixed and a result endpoint added, and the frontend is entirely static scaffolding. Ready to proceed to Proposal."
