# Design: Scraping Logic → Backend → Frontend

## Technical Approach

Three sequential phases closing the end-to-end data flow. Each phase is backward-compatible and independently verifiable: (1) worker POSTs results to backend API, (2) backend persists jobs/products/history and fixes message format, (3) frontend consumes all endpoints.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Worker->Backend transport | RabbitMQ RPC / direct HTTP POST | RPC adds coupling to message patterns; HTTP is simpler and the spec demands it. Worker already has HTTP client deps? No — but Node 18+ has global `fetch`. | **HTTP POST** with retry — no extra deps |
| Worker retry mechanism | Backend requeue / Worker retry | Backend requeue requires ack→dead-letter→reconsume loop; Worker retry is simpler and keeps retry logic colocated with the HTTP call. | **Worker retries 3×** (2s,4s,8s backoff), then ACKs |
| Upsert strategy | `findFirst+update` vs upsert | Prisma has no compound-key upsert. `findFirst({productUrl, domainRuleId})` then create/update is explicit and supports audit logging. | **findFirst + transactional create/update** |
| Scheduled scraping | `@nestjs/schedule` / `node-cron` | `@nestjs/schedule` already in NestJS ecosystem; `node-cron` lighter. Using ScheduleModule from `@nestjs/schedule` is idiomatic. | **@nestjs/schedule** — idiomatic NestJS |
| Frontend polling vs WebSocket | Poll 3s / WebSocket | WS real-time but overkill for this scope. Spec says polling. | **Polling** 3s interval, max 20 attempts |
| Frontend chart lib | Chart.js / QuickChart / Canvas raw | Chart.js is the most stable choice with Angular. Only needed on products detail. | **Chart.js** — lazy-loaded on product expand |

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Angular)                       │
│  UrlInputComponent  ──POST /api/scraping-jobs──┐                │
│       │  poll GET /api/scraping-jobs/:id ◄──────┘                │
│       │  GET /api/domains                                       │
│  ProductsComponent ──GET /api/products──┐                       │
│       │  GET /api/products/:id/history  │                       │
└───────┼──────────────────────────────────┼───────────────────────┘
        │                                  │
┌───────▼──────────────────────────────────▼───────────────────────┐
│                    BACKEND (NestJS + Prisma + PostgreSQL)        │
│                                                                  │
│  POST /scraping-jobs         ──→ ScrapingJobsService.enqueueJob()│
│  POST /scraping-jobs/:id/result ──→ ScrapingJobsController      │
│       │  validate jobId         │                                │
│       ├── success? ──→ ProductsService.upsert()                 │
│       │                 ├─ Product (findByUrl + createOrUpdate)  │
│       │                 └─ PriceHistory (create)                 │
│       └── failure ──→ update job status = failed                │
│                                                                  │
│  ScheduleService (Cron) ──→ enqueueJob for each active schedule  │
└───────┼──────────────────────────────────────────────────────────┘
        │ RabbitMQ message {jobId, url, domainRuleId, selectors}
┌───────▼──────────────────────────────────────────────────────────┐
│    WORKER (Crawlee + Playwright)                                 │
│  consumer.ts: consume message → scrapeUrl()                     │
│    success? ──→ POST /api/scraping-jobs/:id/result ──→ ACK     │
│    failure ──→ POST {success:false, error} ──→ ACK after retries│
└──────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `worker/src/consumer.ts` | Modify | Add `submitResult()` with retry; POST after scrape; ACK on final result |
| `backend/prisma/schema/models/scraping_job.prisma` | **Create** | `ScrapingJob` model (id, domainRuleId, url, status, retryCount, result, etc.) |
| `backend/prisma/schema/schedule.prisma` | **Create** | `ScrapingSchedule` model (cronExpression, domainRuleId, enabled, lastRunAt) |
| `backend/prisma/schema.prisma` | Modify | Re-generate from schema/ directory |
| `backend/src/main.ts` | Modify | Add `ValidationPipe({ whitelist })` + `cors()` |
| `backend/src/modules/scraping-jobs/scraping-jobs.service.ts` | Modify | enqueueJob: lookup DomainRule, include selectors in message; add submitResult() |
| `backend/src/modules/scraping-jobs/scraping-jobs.controller.ts` | Modify | Add POST /:id/result, GET /:id, GET /:id/result, GET /failed, GET / (list) |
| `backend/src/modules/scraping-jobs/scraping-jobs.module.ts` | Modify | Import ProductsModule |
| `backend/src/modules/products/products.service.ts` | Modify | Add upsert() — findFirst by productUrl+domainRuleId, then createOrUpdate + PriceHistory |
| `backend/src/modules/products/products.controller.ts` | Modify | Add POST /upsert, GET /:productId/history, date range filtering |
| `backend/src/modules/products/products.module.ts` | Modify | No changes needed (exports Service) |
| `backend/src/modules/schedules/` | **Create** | New module: controller, service, module — CRUD + cron scheduler |
| `backend/src/app.module.ts` | Modify | Import ScheduleModule, SchedulesModule |
| `backend/package.json` | Modify | Add `@nestjs/schedule` dependency |
| `backend/src/common/domains/` | **Create** | Optional — DTOs and interfaces shared across modules |
| `frontend/src/app/services/api.service.ts` | Modify | Add all endpoint methods + TypeScript interfaces |
| `frontend/src/app/pages/url-input/url-input.component.ts` | Modify | Full form logic: domain select, URL input, submit, polling |
| `frontend/src/app/pages/url-input/url-input.component.html` | Modify | Replace placeholder with functional form |
| `frontend/src/app/pages/products/` | **Create** | ProductsComponent + template + CSS |
| `frontend/src/app/app.ts` | Modify | Add nav bar, cleanup template |
| `frontend/src/app/app.html` | Modify | Replace Angular placeholder with nav + router-outlet |
| `frontend/src/app/app.routes.ts` | Modify | Add /products route |

## Interfaces / Contracts

### Worker → Backend POST body

```typescript
// POST /api/scraping-jobs/:jobId/result
interface ScrapeResultPayload {
  jobId: string;
  success: boolean;
  title?: string;       // present when success=true
  price?: number;
  currency?: string;
  imageUrl?: string;
  sku?: string;
  error?: string;       // present when success=false
}
```

### Backend → Worker (RabbitMQ message, after fix)

```typescript
interface EnqueueMessage {
  jobId: string;
  url: string;
  domainRuleId: string;
  selectors: {
    title: string;
    price: string;
    image?: string;
    sku?: string;
  };
  selectorType: "css" | "xpath";
}
```

### Key DTOs

```typescript
class CreateScrapingJobDto {
  @IsUUID() domainRuleId: string;
  @IsOptional() @IsUrl() url?: string;
}

class SubmitResultDto {
  @IsBoolean() success: boolean;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsNumber() @IsPositive() price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsUrl() imageUrl?: string;
  @IsOptional() @IsString() error?: string;
}

class CreateScheduleDto {
  @IsUUID() domainRuleId: string;
  @IsString() cronExpression: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Worker unit | `submitResult()` — retry logic, POST success/failure | Vitest with mocked fetch; verify backoff delay and ACK behavior |
| Worker integration | Full consumer flow with real RabbitMQ | Docker compose + test container |
| Backend unit | enqueueJob message format, upsert logic | Jest + mocked Prisma |
| Backend integration | POST /scraping-jobs/:id/result → Product upsert → PriceHistory | Supertest + testcontainers (PostgreSQL) |
| Backend unit | ScheduleService cron evaluation | Mock cron expression parser, verify enqueueJob calls |
| Frontend unit | UrlInputComponent — domain load, submit, poll states | Angular TestBed + HttpClientTestingController |
| Frontend unit | ProductsComponent — list, search, empty state, chart lazy-load | TestBed with mock ApiService |

## Migration / Rollout

1. **Phase 1** — No schema changes. Worker starts POSTing; unknown jobIds return 404 (backward-compatible).
2. **Phase 2** — `prisma migrate dev` adds ScrapingJob + ScrapingSchedule tables. Existing products untouched. Old enqueue messages without selectors will be discarded by worker validation — only new enqueues work.
3. **Phase 3** — Pure frontend; no data impact.
4. Rollback per phase: Phase 1 revert worker, Phase 2 `prisma migrate down` + revert code, Phase 3 revert frontend.

## Open Questions

- [ ] Worker `fetch` — Node 18+ global ok? Confirm worker runtime Node version in docker-compose.
- [ ] `rawData` field in `SubmitResultDto` — should the worker send the full raw HTML/JSON? Spec says optional.
- [ ] `ScrapingSchedule` CRUD — manual only or should there be a seed/default schedule on DomainRule create?
