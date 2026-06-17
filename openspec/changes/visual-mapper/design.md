# Design: Visual CSS Selector Mapper

## Technical Approach

Job-based polling for fetch-page (not RPC), injected click handlers inside srcdoc iframe, fieldMappings as optional JSON on DomainRule. Two worker queues: existing `scraping_jobs` for single+listing, new `page-fetch` for HTML preview. Worker consumes both queues concurrently.

## Architecture Decisions

### Decision: Fetch-page return strategy
| Option | Tradeoff | Decision |
|--------|----------|----------|
| RabbitMQ RPC (replyTo) | correlation ID + timeout complexity, existing infra doesn't use it | ❌ |
| Job-based polling | Consistent with existing scraping pattern. POST returns requestId, client polls GET | ✅ |

### Decision: Sandbox click interaction
| Option | Tradeoff | Decision |
|--------|----------|----------|
| CSS overlay on iframe | Click coordinates mismatch, must compute offsets. Fragile with scrolling | ❌ |
| Injected JS in srcdoc | Direct DOM access via postMessage. Simple selector generation. Sandbox prevents XSS | ✅ |

### Decision: Worker queue architecture
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single queue + message type routing | page-fetch jobs block behind long scrapes. Different QoS needs | ❌ |
| Two separate queues | Clear separation. page-fetch is short-lived (prefetch=1). scraping_jobs stays unchanged | ✅ |

### Decision: ScrapingJob type
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Separate ListingJob model | Duplicate CRUD, more code | ❌ |
| type field on ScrapingJob | Single table, simple queries. `single` | `listing` | ✅ |

### Decision: fieldMappings storage
| Option | Tradeoff | Decision |
|--------|----------|----------|
| New table FieldMapping | JOIN overhead, unnecessary normalization for small array | ❌ |
| JSON array on DomainRule | Flexible, no schema migration for new fields. Worker reads at scrape time | ✅ |

## Data Flow

### Fetch-page flow
```
Frontend           Backend                    Worker
  │                   │                        │
  │ POST /fetch-page  │                        │
  │ { url }           │                        │
  │ ──────────────►   │ Create FetchRequest    │
  │                   │ queued                 │
  │                   │ Publish page-fetch     │
  │                   │ ──────────────────►    │ Open URL, wait idle
  │                   │                        │ Extract HTML + elements
  │                   │ POST /fetch-page/:id/  │
  │                   │   result               │
  │ Poll GET          │ ◄──────────────────────│
  │ /fetch-page/:id   │ Update completed       │
  │ ◄───────────────  │                        │
```

### Scrape-listing flow
```
Frontend           Backend                    Worker
  │                   │                        │
  │ POST /scrape-     │                        │
  │   listing         │                        │
  │ { domainRuleId,   │                        │
  │   url, limit }    │                        │
  │ ──────────────►   │ Validate DomainRule    │
  │                   │ Create ScrapingJob     │
  │                   │ type=listing           │
  │                   │ Publish scraping_jobs  │
  │                   │ ──────────────────►    │ Find containers
  │                   │                        │ For each (≤limit):
  │                   │                        │  apply fieldMappings
  │                   │                        │  upsert Product
  │                   │                        │  create PriceHistory
  │                   │ POST /scraping-jobs/   │
  │                   │   :id/result           │
  │ Poll GET          │ ◄──────────────────────│
  │ /scraping-jobs/:id│                        │
  │ ◄───────────────  │                        │
```

## Database Schema Changes

### DomainRule additions (`domain_rule.prisma`)
```prisma
fieldMappings      Json?     // [{ canonicalField, selector, type, attribute? }]
containerSelector  String?
productLimit       Int?      // default max per scrape (default 20)
```

### ScrapingJob addition (`scraping_job.prisma`)
```prisma
type  String  @default("single")  // "single" | "listing"
```

### New: FetchRequest (`fetch_request.prisma`)
```prisma
model FetchRequest {
  id            String    @id @default(uuid()) @db.Uuid
  url           String
  status        String    @default("queued")  // queued | processing | completed | failed
  result        Json?     // { html, title, detectedElements[] }
  errorMessage  String?
  enqueuedAt    DateTime  @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## API Contracts

### POST /api/fetch-page
```typescript
// Request
{ url: string }
// Response 201
{ id: string, status: "queued" }
```

### GET /api/fetch-page/:id
```typescript
// Response 200
{
  id: string, url: string, status: string,
  result?: { html: string, title: string, detectedElements: DetectedElement[] },
  errorMessage?: string
}
// DetectedElement
{ tag: string, text: string, selector: string }
```

### POST /api/fetch-page/:id/result (worker → backend)
```typescript
// Request
{ success: boolean, html?: string, title?: string, detectedElements?: DetectedElement[], error?: string }
// Response 200
{ id: string, status: string }
```

### POST /api/scrape-listing
```typescript
// Request
{ domainRuleId: string, url: string, limit?: number }
// Response 201
{ id: string, status: "queued", type: "listing" }
```

### fieldMappings entry shape
```typescript
{ canonicalField: string, selector: string, type: "text" | "attribute" | "html", attribute?: string }
// canonicalField: title | price | imageUrl | sku | currency | description | category
```

## Component Tree (Angular)

```
VisualMapperComponent
├── UrlBarComponent (input + fetch button)
├── MapperSidebarComponent
│   ├── CanonicalFieldListComponent (7 fields + container)
│   │   └── FieldEntryComponent * N (label, assigned selector chip, remove btn)
│   └── LimitInputComponent (number, default 20)
├── PreviewPaneComponent
│   └── SandboxIframe (srcdoc + injected JS → postMessage)
└── StatusBarComponent (spinner / job link / error)
```

(All implemented as `VisualMapperComponent` with `*ngIf` sections — no child components needed for this phase. Extract later if complexity warrants.)

## Frontend State Machine

```
IDLE → FETCHING → PREVIEW → MAPPING → SCRAPING → DONE
  │       │          │          │          │
  └─── ERROR ◄───────┴──────────┴──────────┘
```

- **IDLE**: URL input + "Fetch Page" button
- **FETCHING**: Spinner, disabled inputs
- **PREVIEW**: Iframe with rendered HTML. Sidebar shows unassigned fields
- **MAPPING**: Fields assigned. Container highlighted with count. "Save & Scrape" enabled when title + price + container mapped
- **SCRAPING**: Polls job status every 3s (max 20 attempts). Shows job ID
- **DONE**: Success + link to `/products`
- **ERROR**: Message + retry button (returns to IDLE)

## Worker Message Handlers

### Existing queue: `scraping_jobs`
- **single** (existing): `{ jobId, url, domainRuleId, selectors, selectorType }` — unchanged flow
- **listing** (new): `{ jobId, url, domainRuleId, limit, type: "listing", containerSelector, fieldMappings, selectorType }`
  - Handler: `scrapeListing()` — finds container elements → iterates ≤limit → applies fieldMappings using `page.locator(field.selector).first()` within each container → collects results → POSTs batch

### New queue: `page-fetch`
- Message: `{ requestId, url }`
- Handler: `fetchPage()` — opens URL with Playwright → `waitForLoadState('networkidle')` → extracts `document.documentElement.outerHTML` + `document.title` → builds `detectedElements` from interactive nodes (buttons, links, inputs, images[alt]) → generates unique CSS selectors → POSTs result
- Timeout: 30s

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema/models/domain_rule.prisma` | Modify | Add fieldMappings, containerSelector, productLimit |
| `backend/prisma/schema/models/scraping_job.prisma` | Modify | Add type field |
| `backend/prisma/schema/models/fetch_request.prisma` | **Create** | New model for fetch-page lifecycle |
| `backend/prisma/schema.prisma` | Modify | Regenerate |
| `backend/src/app.module.ts` | Modify | Register FetchModule |
| `backend/src/modules/fetch-page/` | **Create** | Module, controller, service, DTOs |
| `backend/src/modules/domains/domains.service.ts` | Modify | Accept fieldMappings in create/update |
| `backend/src/modules/domains/domains.controller.ts` | Modify | Accept fieldMappings in body |
| `backend/src/modules/scraping-jobs/scraping-jobs.controller.ts` | Modify | Add `POST /api/scrape-listing` |
| `backend/src/modules/scraping-jobs/scraping-jobs.service.ts` | Modify | Handle listing jobs, fieldMappings in message |
| `backend/src/common/rabbitmq/rabbitmq.config.ts` | Modify | Add page-fetch queue config |
| `worker/src/types.ts` | Modify | Add fieldMappings, listing types, FetchRequest types |
| `worker/src/consumer.ts` | Modify | Consume page-fetch queue + handling listing type |
| `worker/src/scraper.ts` | Modify | Add scrapeListing() + fetchPage() |
| `frontend/src/app/app.routes.ts` | Modify | `/` → VisualMapperComponent, remove `/url-input` |
| `frontend/src/app/services/api.service.ts` | Modify | Add fetchPage(), getFetchResult(), scrapeListing() |
| `frontend/src/app/pages/visual-mapper/*` | Modify | Full state-machine implementation |
| `frontend/src/app/pages/url-input/` | **Delete** | Entire directory |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | FetchPageService (validate+enqueue) | NestJS unit test with mocked Prisma + RabbitMQ |
| Unit | ScrapingJobsService listing logic | Mock Prisma, verify message shape + product upsert |
| Unit | DomainsService fieldMappings CRUD | Verify save/read/fallback behavior |
| Unit | VisualMapperComponent state transitions | Angular TestBed: URL input → fetch → preview → mapping |
| Unit | Sanitization helper | Verify HTML is stripped of scripts before srcdoc |
| Integration | POST /api/fetch-page → FetchRequest created | E2E test with real NestJS app (DB + RabbitMQ mocked) |
| Integration | POST /api/scrape-listing → job enqueued | Verify DomainRule validation, message published |
| E2E | Full visual mapper flow | Browser: paste URL → see preview → click → assign → scrape |

## Migration / Rollout

1. **Prisma migration**: `pnpm --filter backend prisma:migrate add_field_mappings` — adds 3 nullable columns + 1 new table + 1 column on ScrapingJob. No data migration needed.
2. **Worker deployment**: New queues auto-created on `assertQueue`. Worker restarts to consume `page-fetch`.
3. **Route flip**: Old `/url-input` route removed. Users see visual mapper at `/`.
4. **Rollback**: Revert routes, keep columns but ignore them in service. Old worker binary still works with `scraping_jobs` queue only.

## Open Questions

- [ ] Should productLimit default to domain rule's value or always 20 in the frontend?
- [ ] What's the max HTML size for sandbox iframe srcdoc? (Potential memory issue for huge listing pages)
- [ ] Should detectedElements include all elements or only "likely product" ones (heuristic: repeated similar structure)?
