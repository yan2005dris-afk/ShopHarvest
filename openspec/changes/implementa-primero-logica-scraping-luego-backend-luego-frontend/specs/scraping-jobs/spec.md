# Spec — Scraping Jobs

## 1. Objective

Track the complete lifecycle of scraping jobs (queued → processing → completed/failed) with retry support and failure notifications so operators know when scraping fails.

## 2. Scope

**In:** ScrapingJob model, job CRUD, fix enqueueJob to send selectors, result submission endpoint, retry counter, notification mechanism.

**Out:** WebSocket push, admin UI dashboard, job cancellation, pause/resume queue.

## 3. Functional Requirements

### 3.1. ScrapingJob Model
Add a `ScrapingJob` model to Prisma with:
- `id` (UUID)
- `domainRuleId` (FK → DomainRule, required)
- `url` (string, required)
- `status` (enum or string: `queued` | `processing` | `completed` | `failed`)
- `retryCount` (integer, default 0)
- `maxRetries` (integer, default 3)
- `errorMessage` (string, nullable)
- `result` (Json, nullable — stores the scraped data on completion)
- `enqueuedAt` (DateTime, default now)
- `startedAt` (DateTime, nullable)
- `completedAt` (DateTime, nullable)
- `createdAt`, `updatedAt`

### 3.2. Fix enqueueJob
The existing `ScrapingJobsService.enqueueJob()` MUST be updated to:
- Create a `ScrapingJob` record with status `queued`.
- Look up the `DomainRule` by `domainRuleId`.
- Include the domain's selectors in the RabbitMQ message.
- The new message format MUST be:
  ```json
  {
    "jobId": "<scrapingJobId>",
    "url": "<url or sampleUrl>",
    "domainRuleId": "<domainRuleId>",
    "selectors": { "title": "...", "price": "...", "image": "...", "sku": "..." },
    "selectorType": "css"
  }
  ```
- This resolves the message format mismatch (backend was sending `{ domainRuleId, url, timestamp }` without selectors).

### 3.3. Result Endpoint
`POST /api/scraping-jobs/:id/result` — Receives scraped data from the worker:
- Validates `jobId` matches an existing ScrapingJob.
- Updates status to `completed` (or `failed` if `success: false`).
- Stores the result payload in the `result` Json field.
- Calls `ProductsService.upsert()` to persist the product data and price history.
- Returns 404 if `jobId` is unknown, 409 if job is already completed.

### 3.4. Retry Logic
- The backend SHOULD NOT implement server-side retries (the worker handles HTTP retries).
- The `retryCount` on the ScrapingJob reflects how many times the worker attempted submission.
- When `status = failed` and `retryCount < maxRetries`, the backend MAY requeue the job by sending a new message to RabbitMQ (optional enhancement).

### 3.5. Failure Notification
- When a job reaches `status = failed`, the backend MUST log the failure.
- The backend SHOULD provide a notification mechanism: at minimum, a `GET /api/scraping-jobs/failed` endpoint that lists recently failed jobs.
- The notification mechanism MAY be extended to email/webhook in the future (out of scope for now).

### 3.6. Job CRUD
- `GET /api/scraping-jobs` — List jobs (filterable by status, domainRuleId), ordered by `createdAt` DESC.
- `GET /api/scraping-jobs/:id` — Get single job with full details.
- `GET /api/scraping-jobs/:id/result` — Get the result JSON for a completed job.

## 4. Non-Functional Requirements
- The enqueue flow MUST be transactional: creating the ScrapingJob record and sending the RabbitMQ message should be resilient — if RabbitMQ is down, the job record is still created with status `queued`.
- All job endpoints MUST require the job ID as a UUID path parameter.

## 5. Scenarios

### 5.1. Enqueue a scraping job
**Given** a valid `domainRuleId`  
**When** POST `/api/scraping-jobs` is called  
**Then** a ScrapingJob is created with status `queued`  
**And** a RabbitMQ message with full selectors is sent  
**And** the response includes the job ID

### 5.2. Worker submits result
**Given** a ScrapingJob with status `queued`  
**When** POST `/api/scraping-jobs/:id/result` receives `{ success: true, ... }`  
**Then** the job status becomes `completed`  
**And** a Product is upserted  
**And** a PriceHistory entry is created

### 5.3. Worker reports failure
**Given** a ScrapingJob with status `processing`  
**When** POST `/api/scraping-jobs/:id/result` receives `{ success: false, error: "Timeout" }`  
**Then** the job status becomes `failed`  
**And** the error message is stored  
**And** the failure is logged

### 5.4. Invalid jobId on result submission
**Given** no ScrapingJob with the given ID exists  
**When** POST `/api/scraping-jobs/:id/result` is called  
**Then** the endpoint returns 404
