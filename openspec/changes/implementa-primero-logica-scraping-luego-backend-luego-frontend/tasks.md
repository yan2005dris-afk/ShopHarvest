# Tasks — Scraping Logic → Backend → Frontend

## Review Workload Forecast

CHANGE: implementa-primero-logica-scraping-luego-backend-luego-frontend
FORECAST: 530-630 lines across ~28 files across 3 Docker services
400-BUDGET-RISK: HIGH
CHAINED-PRS-RECOMMENDED: YES (3 phases, each autonomous)
DELIVERY-STRATEGY: ask-on-risk
BREAKDOWN:
  Phase 1 (Scraping Worker + DB model): ~80 lines — 5 files (worker/src/consumer.ts, backend/prisma/schema/models/scraping_job.prisma, backend/prisma/schema.prisma, worker/src/types.ts)
  Phase 2 (Backend): ~280-330 lines — ~15 files (main.ts, scraping-jobs/*, products/*, schedule/*, DTOs, app.module.ts, package.json)
  Phase 3 (Frontend): ~200-220 lines — ~8 files (api.service.ts, url-input/*, products/*, app.html, app.routes.ts)

---

## Phase 1 — Scraping Worker + ScrapingJob DB Model

### 1.1. Create ScrapingJob Prisma model

**Files:**
- `backend/prisma/schema/models/scraping_job.prisma` — **Create**
- `backend/prisma/schema.prisma` — Modify (regenerate)
- `backend/prisma/migrations/` — Auto-generated via `prisma migrate dev`

**Spec:** scraping-jobs §3.1

**Do:**
- Create model `ScrapingJob` with fields:
  - `id` (String, UUID, `@db.Uuid`)
  - `domainRuleId` (String, `@db.Uuid`, FK → DomainRule)
  - `url` (String)
  - `status` (String, default `"queued"`)
  - `retryCount` (Int, default 0)
  - `maxRetries` (Int, default 3)
  - `errorMessage` (String?)
  - `result` (Json?)
  - `enqueuedAt` (DateTime, `@default(now())`)
  - `startedAt` (DateTime?)
  - `completedAt` (DateTime?)
  - `createdAt`, `updatedAt` (standard timestamps)
- Add relation from `DomainRule` → `ScrapingJob[]`
- Add `@@index([domainRuleId])`
- Run `pnpm prisma:generate-schema` to regenerate `schema.prisma`
- Run `pnpm prisma migrate dev --name add_scraping_job` to apply migration

**Verify:**
- [x] `npx prisma studio` shows ScrapingJob table with all fields
- [ ] Migration file committed

---

### 1.2. Add `submitResult()` with retry logic to worker consumer

**Files:**
- `worker/src/consumer.ts` — Modify
- `worker/src/types.ts` — Modify (add submit result payload type)

**Spec:** scraping-worker §3.1, §3.2, §3.3, §3.4

**Do:**
- In `consumer.ts`, extract the scrape result / error handling after `scrapeUrl()` call (lines 93-102 currently NACK+requeue on scrape error)
- Create `submitResult(jobId: string, payload: ScrapeResultPayload): Promise<boolean>` function that:
  - POSTs to `${BACKEND_API_URL}/api/scraping-jobs/${jobId}/result`
  - Uses `fetch()` (Node 18+ global, no extra deps; verify worker Node version first)
  - Sets `Content-Type: application/json`
  - Sets `HTTP_TIMEOUT_MS` from env (default 10_000ms) via `AbortSignal.timeout()`
  - Retries on network error or non-2xx: 3 attempts total with exponential backoff 2s, 4s, 8s (use a helper `sleep(ms)` or `setTimeout` in a loop)
  - Logs each attempt with status code or error
  - Returns `true` on success, `false` after all retries exhausted
- Replace the current result handling block (lines 104-108):
  - On **successful scrape**: call `submitResult()` → if ok, ACK; if retries exhausted, ACK anyway and log "Failed to submit result after 3 retries"
  - On **scrape failure**: POST `{ success: false, error: <message> }` to backend → ACK after retries
- Read `BACKEND_API_URL` from `process.env` at top, default `http://backend:3000`
- Add `ScrapeResultPayload` interface to `types.ts` matching design §Interfaces

**Important contract — ACK behavior:**
- Successful POST (2xx) → `channel.ack(msg)` immediately
- Final retry exhaustion → `channel.ack(msg)` (do NOT requeue — the backend marks the job as failed)
- Scrape failure before any POST → still POST `{ success: false, error }`, then ACK (don't NACK+requeue as current code does)

**Verify:**
- [x] Worker logs "Submitting result for job X" before POST
- [x] Worker retries 3× with 2s/4s/8s delays on 500
- [x] On success: ACK + log "Result submitted successfully"
- [x] On retry exhaustion: ACK + log "Failed to submit result after 3 retries"
- [x] On scrape error: POSTs failure payload, ACKs
- [x] `BACKEND_API_URL` env var respected

---

## Phase 2 — Backend: CORS, ScrapingJob CRUD, enqueueJob fix, Result Endpoint, PriceHistory, Scheduler

### 2.1. Enable CORS + ValidationPipe globally

**Files:**
- `backend/src/main.ts` — Modify

**Spec:** design §Technical Approach

**Do:**
- Add `app.enableCors()` before `app.listen()`
- Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
- Import `ValidationPipe` from `@nestjs/common`

**Verify:**
- [x] Backend starts without error
- [x] Preflight OPTIONS requests return 204 with CORS headers
- [x] Invalid DTO bodies return 400 with structured validation errors

---

### 2.2. Fix `enqueueJob` — lookup DomainRule, include selectors in RabbitMQ message

**Files:**
- `backend/src/modules/scraping-jobs/scraping-jobs.service.ts` — Modify
- `backend/src/modules/scraping-jobs/scraping-jobs.module.ts` — Modify
- `backend/src/modules/scraping-jobs/scraping-jobs.controller.ts` — Modify
- `backend/src/modules/domains/domains.service.ts` — May need `export` or extra method

**Spec:** scraping-jobs §3.2, design §Contracts

**Do:**
- Inject `PrismaService` into `ScrapingJobsService`
- Inject `DomainsService` (or use Prisma directly to query DomainRule by ID)
- Update `enqueueJob(domainRuleId, url?)`:
  1. Create a `ScrapingJob` record with status `queued`, url, domainRuleId
  2. Look up the `DomainRule` by `domainRuleId` — get its selectors (`selectorTitle`, `selectorPrice`, `selectorImage`, `selectorSku`, `selectorType`)
  3. Build the message payload per design contract:
     ```json
     {
       "jobId": "<scrapingJob.id>",
       "url": "<url or domainRule.sampleUrl>",
       "domainRuleId": "<domainRuleId>",
       "selectors": { "title": "...", "price": "...", "image": "...", "sku": "..." },
       "selectorType": "css"
     }
     ```
  4. Send to RabbitMQ as before
  5. Return the created ScrapingJob (including its id)
- Update `ScrapingJobsModule` to import `PrismaModule` and `DomainsModule`
- Update `ScrapingJobsController.enqueue()` to return the job object from service (not just `{ queued: true }`)

**Verify:**
- [x] POST `/api/scraping-jobs` with `{ domainRuleId, url }` creates a ScrapingJob row in DB
- [x] RabbitMQ message now contains `jobId`, `selectors`, `selectorType` fields
- [x] If domainRuleId doesn't exist, returns 404 or appropriate error

---

### 2.3. Create DTOs for all endpoints

**Files:**
- `backend/src/modules/scraping-jobs/dto/` — **Create directory**
- `backend/src/modules/scraping-jobs/dto/create-scraping-job.dto.ts` — **Create**
- `backend/src/modules/scraping-jobs/dto/submit-result.dto.ts` — **Create**
- `backend/src/modules/products/dto/` — **Create directory**
- `backend/src/modules/products/dto/upsert-product.dto.ts` — **Create**
- `backend/src/modules/products/dto/product-query.dto.ts` — **Create**
- `backend/src/modules/schedules/dto/` — **Create directory**
- `backend/src/modules/schedules/dto/create-schedule.dto.ts` — **Create**
- `backend/src/modules/schedules/dto/update-schedule.dto.ts` — **Create**

**Spec:** design §Key DTOs, scraping-jobs §3.3, product-tracking §3.4

**Do:**
- Create DTOs using `class-validator` decorators per design spec:
  - `CreateScrapingJobDto`: `@IsUUID() domainRuleId`, `@IsOptional() @IsUrl() url?`
  - `SubmitResultDto`: `@IsBoolean() success`, `@IsOptional() @IsString() title?`, `@IsOptional() @IsNumber() @IsPositive() price?`, `@IsOptional() @IsString() currency?`, `@IsOptional() @IsUrl() imageUrl?`, `@IsOptional() @IsString() sku?`, `@IsOptional() @IsString() error?`
  - `UpsertProductDto`: `@IsUUID() domainRuleId`, `@IsUrl() productUrl`, `@IsString() title`, `@IsOptional() @IsNumber() @IsPositive() price?`, `@IsOptional() @IsString() currency?`, `@IsOptional() @IsUrl() imageUrl?`, `@IsOptional() @IsString() sku?`, `@IsOptional() @IsString() description?`, `@IsOptional() @IsObject() rawData?`
  - `ProductQueryDto`: `@IsOptional() @IsBoolean() includeHistory?`, `@IsOptional() @IsUUID() domainRuleId?`
  - `CreateScheduleDto`: `@IsUUID() domainRuleId`, `@IsString() cronExpression`, `@IsOptional() @IsBoolean() enabled?`
  - `UpdateScheduleDto`: `@IsOptional() @IsString() cronExpression?`, `@IsOptional() @IsBoolean() enabled?`

**Verify:**
- [x] All DTO files compile without errors
- [x] ValidationPipe rejects invalid payloads with 400

---

### 2.4. Add `POST /scraping-jobs/:id/result` endpoint

**Files:**
- `backend/src/modules/scraping-jobs/scraping-jobs.service.ts` — Modify
- `backend/src/modules/scraping-jobs/scraping-jobs.controller.ts` — Modify
- `backend/src/modules/scraping-jobs/scraping-jobs.module.ts` — Modify
- `backend/src/modules/products/products.service.ts` — Modify
- `backend/src/modules/products/products.controller.ts` — Modify

**Spec:** scraping-jobs §3.3, §3.5, product-tracking §3.1, §3.2, §3.3

**Do:**
- In `ScrapingJobsService`, add `submitResult(jobId: string, dto: SubmitResultDto)` method:
  1. Find ScrapingJob by `jobId` — return null (controller returns 404)
  2. If job already `completed`, controller returns 409
  3. Update job status to `completed` (if `dto.success`) or `failed` (if `!dto.success`)
  4. Store `dto` as `result` JSON field
  5. If `dto.success`, call `ProductsService.upsert()` with the scraped data
  6. If failed, store `dto.error` in `errorMessage`
- In `ScrapingJobsController`, add:
  - `POST :id/result` — validate `SubmitResultDto`, call `submitResult()`, handle 404/409
  - `GET :id` — return single job
  - `GET :id/result` — return the `result` JSON field
  - `GET failed` — return jobs with status `failed`
  - `GET` (list) — support `?status=` and `?domainRuleId=` filters
- In `ProductsService`, add `upsert(dto: UpsertProductDto)`:
  1. `findFirst({ where: { productUrl: dto.productUrl, domainRuleId: dto.domainRuleId } })`
  2. If found: update with dto fields (title, price, currency, imageUrl, sku, extractedAt)
  3. If not found: create new Product
  4. In **both** cases: create a new `PriceHistory` record with current `price`, `currency`, `capturedAt = now()`
  5. Make it transactional: use `this.prisma.$transaction()` to wrap upsert + PriceHistory create
- In `ProductsController`, add:
  - `POST upsert` — call `productsService.upsert()` (even though the main flow goes through scraping-jobs result, having a direct upsert endpoint is useful)
  - `GET :productId/history` — support `?from=` and `?to=` date filtering
- In `ScrapingJobsModule`, import `ProductsModule` so it can use `ProductsService`

**Verify:**
- [x] POST `/api/scraping-jobs/:id/result` with `{ success: true, title: "Test", price: 99.99 }` creates Product + PriceHistory
- [x] Same jobId returns 409 on second call
- [x] Invalid jobId returns 404
- [x] Failed result (`{ success: false, error: "timeout" }`) marks job as failed
- [x] GET `/api/scraping-jobs/failed` returns failed jobs
- [x] GET `/api/products/:id/history?from=2025-01-01&to=2026-06-16` returns filtered results

---

### 2.5. Add PriceHistory CRUD (controller, service)

**Files:**
- `backend/src/modules/products/products.service.ts` — Modify (already adding history query in 2.4)
- `backend/src/modules/products/products.controller.ts` — Modify (already adding history endpoint in 2.4)
- Optionally: `backend/src/modules/price-history/` — only if separate module is preferred (design says model exists, controller+service can live inside products module)

**Spec:** product-tracking §3.3

**Do:**
- In `ProductsService`, add:
  - `getPriceHistory(productId: string, from?: string, to?: string)` — query PriceHistory ordered by `capturedAt` DESC, with optional date range filter on `capturedAt`
- Add `GET /api/products/:productId/history` endpoint in `ProductsController` (done in 2.4)
- Optionally add aggregate endpoint `GET /api/price-history` with `?productId=&domainRuleId=` query params if needed

**Verify:**
- [x] GET `/api/products/:id/history` returns price history ordered by date DESC
- [x] Date range filter works correctly
- [x] Returns empty array for product with no history

---

### 2.6. Create ScrapingSchedule model + CRUD + cron service

**Files:**
- `backend/prisma/schema/models/schedule.prisma` — **Create**
- `backend/prisma/schema.prisma` — Modify (regenerate)
- `backend/src/modules/schedules/schedules.module.ts` — **Create**
- `backend/src/modules/schedules/schedules.service.ts` — **Create**
- `backend/src/modules/schedules/schedules.controller.ts` — **Create**
- `backend/src/app.module.ts` — Modify
- `backend/package.json` — Modify

**Spec:** scraping-scheduler §3.1, §3.2, §3.3, §3.4

**Do:**
- Create `schedule.prisma` model `ScrapingSchedule` with:
  - `id` (String, UUID, `@db.Uuid`)
  - `domainRuleId` (String, `@db.Uuid`, FK → DomainRule)
  - `cronExpression` (String)
  - `enabled` (Boolean, default `true`)
  - `lastRunAt` (DateTime?)
  - `createdAt`, `updatedAt`
  - `@@index([enabled])`
- Add relation from `DomainRule` → `ScrapingSchedule[]`
- Regenerate schema + run migration: `pnpm prisma migrate dev --name add_scraping_schedule`
- Install `@nestjs/schedule` package
- Create `SchedulesModule` with CRUD:
  - `SchedulesService`: `create()`, `findAll()`, `findOne()`, `update()`, `remove()` — standard CRUD
  - `SchedulesController`: REST endpoints under `/api/schedules`
    - `POST /` — create schedule (validated)
    - `GET /` — list all
    - `GET /:id` — single
    - `PATCH /:id` — update
    - `DELETE /:id` — remove
- Create `ScheduleService` (cron executor):
  - Implement `OnModuleInit` — start a programmatic interval (e.g., every 60s) that queries all `ScrapingSchedule` where `enabled = true`
  - For each schedule, check if the cron expression matches the current time (use `node-cron` parser or `cron-parser` package — simpler than `@Cron()` decorator since expressions vary)
  - If match: call `ScrapingJobsService.enqueueJob(domainRuleId)` with optional `sampleUrl`
  - Update `lastRunAt` after enqueuing
  - If invalid cron expression: log warning and skip
- Import `ScheduleModule` from `@nestjs/schedule` in `AppModule`
- Import `SchedulesModule` in `AppModule`

**Verify:**
- [x] POST `/api/schedules` creates a new schedule record
- [x] PATCH `/api/schedules/:id` with `{ enabled: false }` disables it
- [x] With an active schedule matching current time, a ScrapingJob is created
- [x] Invalid cron expression logs warning and doesn't crash

---

## Phase 3 — Frontend: ApiService, UrlInput, Products List, Navigation

### 3.1. Wire up ApiService with all endpoint methods

**Files:**
- `frontend/src/app/services/api.service.ts` — Modify

**Spec:** url-input §3.1, product-history-ui §3.1

**Do:**
- Add TypeScript interfaces at top of file (or in separate `types.ts`):
  - `DomainRule { id: string; domain: string; name: string; selectors: {...}; sampleUrl?: string }`
  - `ScrapingJob { id: string; domainRuleId: string; url: string; status: string; ... }`
  - `Product { id: string; title: string; price: number; currency: string; productUrl: string; imageUrl?: string; domainRule: DomainRule; priceHistory: PriceHistory[] }`
  - `PriceHistory { id: string; price: number; currency: string; capturedAt: string }`
- Add methods to `ApiService`:
  - `getDomains(): Observable<DomainRule[]>`
  - `enqueueJob(domainRuleId: string, url: string): Observable<{ id: string }>`
  - `getJobStatus(jobId: string): Observable<ScrapingJob>`
  - `getJobResult(jobId: string): Observable<any>`
  - `getProducts(includeHistory?: boolean): Observable<Product[]>`
  - `getProduct(id: string): Observable<Product>`
  - `getPriceHistory(productId: string, from?: string, to?: string): Observable<PriceHistory[]>`

**Verify:**
- [x] All methods compile
- [x] `getDomains()` calls `GET /api/domains`

---

### 3.2. Build UrlInputComponent — domain dropdown + URL input + submit + results

**Files:**
- `frontend/src/app/pages/url-input/url-input.component.ts` — Modify
- `frontend/src/app/pages/url-input/url-input.component.html` — Modify
- `frontend/src/app/pages/url-input/url-input.component.css` — Modify

**Spec:** url-input §3.2, §3.3, §3.5

**Do:**
- `url-input.component.ts`:
  - Inject `ApiService`
  - On init: call `apiService.getDomains()` → populate `domains` array
  - Properties: `selectedDomainId`, `url`, `jobStatus`, `jobResult`, `isLoading`, `error`
  - `submit()`: validate → call `apiService.enqueueJob()` → start polling every 3s with `setInterval` (max 20 polls = 60s)
  - Polling: call `apiService.getJobStatus()` → update `jobStatus`; if `completed`, stop polling, fetch result; if `failed`, stop polling
  - `ngOnDestroy()`: clear interval to prevent memory leaks
  - URL domain validation: compare entered URL's hostname with selected DomainRule's `domain`; show warning if mismatch but allow submission
- `url-input.component.html`:
  - Domain `<select>` with loading/empty states
  - URL `<input type="url">` with validation
  - Submit button with loading spinner (disabled while in-flight)
  - Results display area:
    - Status badge (`queued`/`processing`/`completed`/`failed`) with color coding
    - For completed: title, price, currency, image thumbnail
    - For failed: error message
    - Link to `/products` page
- `url-input.component.css`:
  - Clean form layout, responsive
  - Loading spinner styling
  - Status badge colors (green for completed, red for failed, yellow for processing)

**Verify:**
- [x] Domain dropdown loads from API
- [x] Empty state shows "No domains configured" + disabled submit
- [x] Submit button disabled while loading
- [x] Polling starts after enqueue, stops on completion/failure
- [x] Interval cleaned up on destroy
- [x] URL domain mismatch shows warning

---

### 3.3. Build ProductsPageComponent — product list with filters

**Files:**
- `frontend/src/app/pages/products/products.component.ts` — **Create**
- `frontend/src/app/pages/products/products.component.html` — **Create**
- `frontend/src/app/pages/products/products.component.css` — **Create**
- `frontend/src/app/app.routes.ts` — Modify
- `frontend/src/app/app.html` — Modify (navigation)
- `frontend/src/app/app.ts` — Modify (import router link)

**Spec:** product-history-ui §3.2, §3.4, §3.5

**Do:**
- `products.component.ts`:
  - Inject `ApiService`
  - On init: call `apiService.getProducts()` → populate `products` array
  - Properties: `products`, `filteredProducts`, `searchTerm`, `selectedProduct`, `isLoading`, `error`
  - `filterProducts()`: client-side filter by title (case-insensitive, accent-aware via `String.prototype.localeCompare` or `.normalize()`)
  - `selectProduct(product)`: toggle selected → load price history via `apiService.getPriceHistory()` → render chart (deferred)
  - Lazy-load chart: only initialize Chart.js when a product is expanded (use `AfterViewInit` + conditional rendering in template)
- `products.component.html`:
  - Header with title + total count
  - Search input with debounce
  - Product cards/rows: thumbnail, title, price+currency, domain name, last extracted date
  - Expandable detail section: price history table (Date | Price | Currency), line chart
  - Loading skeleton / spinner
  - Empty state: "No products tracked yet. Start by scraping a URL." + link to `/url-input`
  - Error state: error message + retry button
- Install Chart.js: `npm install chart.js` (or angular wrapper `ng2-charts`)
- Chart: simple line chart, X=capturedAt, Y=price, handle 1 data point as a dot
- `app.routes.ts`: add `{ path: 'products', component: ProductsComponent }` (import and add to routes array)
- `app.html`: Replace the Angular placeholder content with a minimal nav bar:
  - Navigation links: "URL Input" (`/url-input`), "Products" (`/products`)
  - `<router-outlet />` below the nav
  - Clean up the massive SVG/placeholder template (keep it simple)
- `app.ts`: Ensure `RouterLink`, `RouterLinkActive` directives are imported (add to component imports)

**Verify:**
- [x] Navigating to `/products` shows product list
- [x] Search filters products client-side
- [x] Clicking a product toggles price history table + chart
- [x] Empty state shows message + link to url-input
- [x] Error state shows retry button
- [x] Navigation between `/url-input` and `/products` works
- [x] Chart renders correctly with 1 or more data points

---

### 3.4. Navigation shell final cleanup

**Files:**
- `frontend/src/app/app.html` — Modify (done in 3.3)
- `frontend/src/app/app.css` — Modify (if needed)

**Do:**
- Ensure the nav bar has active-link styling
- Ensure mobile-responsive layout
- Remove any remaining Angular placeholder SVG/content from app.html

**Verify:**
- [x] App shell is clean, no placeholder artifacts
- [x] Active nav link is visually highlighted
- [x] Responsive on mobile viewport

---

## Delivery Notes

### Chained PR Strategy
Each phase is a standalone PR — phases are backward-compatible and independently verifiable:

1. **PR 1: Phase 1** — Worker POSTs results + ScrapingJob model. Backend ignores unknown POSTs (404 = safe).
2. **PR 2: Phase 2** — Backend endpoints + scheduler. Existing enqueues without selectors get a sensible default (worker discards if selectors missing, but all new enqueues work).
3. **PR 3: Phase 3** — Frontend pages. Pure UI, no data impact.

### Rollback
- Phase 1: revert `consumer.ts` + migration rollback
- Phase 2: `prisma migrate down` + revert code
- Phase 3: revert frontend files

### Key Risks
- **Worker Node version**: `fetch()` is global in Node 18+. Verify `FROM node:...` in Dockerfile before using it. If < 18, install `node-fetch`.
- **DomainRule.selectors**: The Prisma model uses flat field names (`selectorTitle`, `selectorPrice`, etc.) but the worker expects `selectors.title`, `selectors.price`. The `enqueueJob` fix must map between the two formats.
- **Duplicate products**: `findFirst` by `productUrl + domainRuleId` catches duplicates. The Prisma schema already has `@@index([productUrl])` and `@@index([domainRuleId])`.
- **`@nestjs/schedule`**: Not currently in `package.json`. Must be installed and `ScheduleModule.forRoot()` imported in `AppModule`.
