# Tasks: Visual CSS Selector Mapper

> Generated from proposal → spec → design → tasks pipeline.

## Delivery Constraints

| Constraint | Value |
|------------|-------|
| Git commits | None during implementation |
| Mode | Interactive (ask on risk) |
| Artifacts | openspec living docs |
| Review budget | 400 lines max per review pass |
| Strict TDD | Skipped (no test runner) |

## Task Summary

| ID | Title | Phase | Deps | Files | Est. Lines |
|----|-------|-------|------|-------|------------|
| 1.1 | Prisma migration — DomainRule + ScrapingJob + FetchRequest | Data model | — | 5 | +55 / -0 |
| 1.2 | Backend fetch-page module | Backend | 1.1 | 8 | +210 / -0 |
| 1.3 | Backend scrape-listing endpoint | Backend | 1.1 | 4 | +65 / -10 |
| 2.1 | Worker page-fetch queue consumer | Worker | 1.2 | 2 | +90 / -0 |
| 2.2 | Worker listing scraping logic | Worker | 1.3, 2.1 | 2 | +85 / -0 |
| 2.3 | Product limit support | Worker | 2.2 | 1 | +20 / -0 |
| 3.1 | VisualMapperComponent state machine + URL input + fetch integration | Frontend | 1.2 | 4 | +200 / -0 |
| 3.2 | Sandboxed HTML preview with srcdoc iframe + click handlers | Frontend | 3.1 | 2 | +120 / -0 |
| 3.3 | Click-to-select overlay with field assignment | Frontend | 3.2 | 1 | +150 / -0 |
| 3.4 | Container selector detection + limit input | Frontend | 3.1 | 1 | +60 / -0 |
| 3.5 | Save domain rule → trigger scrape → poll results | Frontend | 1.3, 3.3, 3.4 | 3 | +80 / -0 |
| 4.1 | Route replacement + remove url-input | Cleanup | 3.5 | 5 | +5 / -80 |
| 4.2 | Verify backward compatibility | Cleanup | 4.1 | — | 0 |
| **Total** | | | | **~38** | **~+1140 / -90** |

---

## Task 1.1 — Prisma Migration: DomainRule + ScrapingJob + FetchRequest  [x]

### Description
Add schema changes: `fieldMappings Json?`, `containerSelector String?`, `productLimit Int?` to DomainRule; `type String @default("single")` to ScrapingJob; create new `FetchRequest` model.

### Dependencies
None (foundational).

### Files Changed (5)
| File | Action | Est. Lines |
|------|--------|------------|
| `backend/prisma/schema/models/domain_rule.prisma` | Modify | +5 |
| `backend/prisma/schema/models/scraping_job.prisma` | Modify | +2 |
| `backend/prisma/schema/models/fetch_request.prisma` | **Create** | +20 |
| `backend/prisma/schema.prisma` | Modify | +1 |
| Prisma migration (auto-generated) | Create | +25 |

### Estimated Lines
+55 / -0

### Acceptance Criteria
- [x] `fieldMappings Json?`, `containerSelector String?`, `productLimit Int?` exist on DomainRule
- [x] `type String @default("single")` exists on ScrapingJob
- [x] `FetchRequest` model created with id, url, status, result, errorMessage, timestamps
- [x] Prisma migration generates and applies cleanly
- [x] Old `selector*` columns preserved for backward compat
- [ ] `pnpm --filter backend prisma:generate` succeeds (requires DB)

---

## Task 1.2 — Backend Fetch-Page Module  [x]

### Description
Create `FetchModule` with `POST /api/fetch-page` endpoint. Service validates URL, creates FetchRequest record, publishes `page-fetch` message to new RabbitMQ queue, returns request ID for polling. Add `GET /api/fetch-page/:id` for status polling (completed → returns HTML + detectedElements). Add `POST /api/fetch-page/:id/result` (worker callback). Register FetchModule in AppModule, configure new queue in rabbitmq config.

### Dependencies
1.1 (FetchRequest model must exist).

### Files Changed (8)
| File | Action | Est. Lines |
|------|--------|------------|
| `backend/src/modules/fetch-page/fetch-page.module.ts` | **Create** | +12 |
| `backend/src/modules/fetch-page/fetch-page.controller.ts` | **Create** | +65 |
| `backend/src/modules/fetch-page/fetch-page.service.ts` | **Create** | +80 |
| `backend/src/modules/fetch-page/dto/create-fetch-request.dto.ts` | **Create** | +10 |
| `backend/src/modules/fetch-page/dto/fetch-result.dto.ts` | **Create** | +10 |
| `backend/src/modules/fetch-page/dto/index.ts` | **Create** | +3 |
| `backend/src/app.module.ts` | Modify | +2 |
| `backend/src/common/rabbitmq/rabbitmq.config.ts` | Modify | +5 |
| `backend/src/modules/fetch-page/index.ts` | **Create** | +3 |

### Estimated Lines
+210 / -0

### Acceptance Criteria
- [x] `POST /api/fetch-page` accepts `{ url }`, returns `{ id, status: "queued" }`
- [x] URL validation (must be valid HTTP/HTTPS URL)
- [x] Creates FetchRequest with status `queued`
- [x] Publishes `{ requestId, url }` to `page-fetch` queue
- [x] `GET /api/fetch-page/:id` returns current status + optional result
- [x] `POST /api/fetch-page/:id/result` accepts worker callback, updates record
- [x] FetchModule registered in AppModule
- [x] `page-fetch` queue configured in rabbitmq config
- [x] Error cases: invalid URL → 400, not found → 404

---

## Task 1.3 — Backend Scrape-Listing Endpoint  [x]

### Description
Add `POST /api/scrape-listing` to ScrapingJobsController. Service method validates DomainRule (requires containerSelector + fieldMappings), creates ScrapingJob with `type='listing'`, publishes enriched message to `scraping_jobs` queue with containerSelector + fieldMappings + limit. Update `CreateScrapingJobDto` to accept limit param.

### Dependencies
1.1 (ScrapingJob.type + DomainRule fields).

### Files Changed (6)
| File | Action | Est. Lines |
|------|--------|------------|
| `backend/src/modules/scraping-jobs/scraping-jobs.controller.ts` | Modify | +15 |
| `backend/src/modules/scraping-jobs/scraping-jobs.service.ts` | Modify | +40 |
| `backend/src/modules/scraping-jobs/dto/create-scraping-job.dto.ts` | Modify | +5 |
| `backend/src/modules/scraping-jobs/dto/scrape-listing.dto.ts` | **Create** | +10 |
| `backend/src/modules/scraping-jobs/dto/index.ts` | Modify | +1 |

### Estimated Lines
+65 / -10 (updated existing enqueueJob to handle listing type, new route)

### Acceptance Criteria
- [x] `POST /api/scrape-listing` accepts `{ domainRuleId, url, limit? }`, returns `{ id, status: "queued", type: "listing" }`
- [x] Validates DomainRule has containerSelector + fieldMappings set
- [x] Creates ScrapingJob with `type: "listing"`
- [x] Message includes `containerSelector`, `fieldMappings[]`, `limit` (default 20)
- [x] Existing `POST /api/scraping-jobs` (single) unchanged
- [x] Missing containerSelector → 400 with clear error

---

## Task 2.1 — Worker: Page-Fetch Queue Consumer

### Description
Add second RabbitMQ consumer for `page-fetch` queue in worker. Handler opens URL with Playwright (reuse existing crawler setup), waits for `networkidle`, extracts `document.documentElement.outerHTML` and `document.title`, builds `detectedElements` list from interactive elements (buttons, links, inputs, images-with-alt), generates unique CSS selectors for each. POSTs result back to `POST /api/fetch-page/:id/result`. 30s timeout per fetch.

### Dependencies
1.2 (fetch-page module, queue, callback endpoint).

### Files Changed (2)
| File | Action | Est. Lines |
|------|--------|------------|
| `worker/src/types.ts` | Modify | +25 |
| `worker/src/scraper.ts` | Modify | +65 |

### Estimated Lines
+90 / -0

### Acceptance Criteria
- [ ] Worker connects to `page-fetch` queue on startup (alongside existing `scraping_jobs`)
- [ ] Handler receives `{ requestId, url }`, opens URL with Playwright
- [ ] Extracts full HTML + page title
- [ ] Detects interactive elements and generates CSS selectors
- [ ] POSTs result to `POST /api/fetch-page/:id/result` within 30s
- [ ] 30s timeout → sends failure result
- [ ] Sanitization: scripts removed from HTML before returning
- [ ] Error handling: network error → POSTs failure, ACKs message
- [ ] No regression to existing single-URL scraping flow

---

## Task 2.2 — Worker: Listing Scraping Logic

### Description
New `scrapeListing()` function. Receives message with `type: "listing"`, `containerSelector`, `fieldMappings[]`, `limit`. Uses Playwright to find container elements via `page.locator(containerSelector)`, limits to N (≤limit). For each container, applies each fieldMapping:
- `type: "text"` → `.textContent()`, `type: "attribute"` → `.getAttribute(attribute)`, `type: "html"` → `.innerHTML()`. Collects results, batches them via `POST /api/scraping-jobs/:id/result` with array of extracted products.

### Dependencies
1.3 (listing message format), 2.1 (concurrent consumer architecture).

### Files Changed (2)
| File | Action | Est. Lines |
|------|--------|------------|
| `worker/src/types.ts` | Modify | +20 |
| `worker/src/scraper.ts` | Modify | +65 |

### Estimated Lines
+85 / -0

### Acceptance Criteria
- [ ] `scrapeListing()` accepts `{ jobId, url, containerSelector, fieldMappings, limit }`
- [ ] Opens URL, waits for `networkidle`
- [ ] Finds container elements, limits to N
- [ ] Per container: applies each fieldMapping by type (text/attribute/html)
- [ ] Collects all results as array
- [ ] POSTs batch result to backend with product data
- [ ] Handles empty container list → success with 0 products
- [ ] Handles partial field extraction (missing fields → null)
- [ ] No regression to existing single-URL scraping

---

## Task 2.3 — Worker: Product Limit Support

### Description
Add product limit enforcement during listing extraction. If `limit` is set, cap the number of product containers processed. Default 20, max 100. Ensure the limit is applied before extraction loop (not after) to avoid unnecessary work.

### Dependencies
2.2 (builds on listing scraping loop).

### Files Changed (1)
| File | Action | Est. Lines |
|------|--------|------------|
| `worker/src/scraper.ts` | Modify | +20 |

### Estimated Lines
+20 / -0

### Acceptance Criteria
- [ ] Limit applied pre-extraction (not post-filter)
- [ ] Default limit = 20 when not specified
- [ ] Cap limit at 100 (any higher treated as 100)
- [ ] If page has fewer containers than limit → processes all
- [ ] Limit logged in worker output

---

## Task 3.1 — VisualMapperComponent: State Machine + URL Input + Fetch  [x]

### Description
Implement state machine (IDLE → FETCHING → PREVIEW → MAPPING → SCRAPING → DONE | ERROR) in VisualMapperComponent. URL input bar with "Fetch Page" button. POSTs URL to `/api/fetch-page`, polls `GET /api/fetch-page/:id` every 2s. On completion: transitions to PREVIEW state, stores HTML + detectedElements. Error state shows message + retry. Add `fetchPage()` and `getFetchResult()` to ApiService.

### Dependencies
1.2 (fetch-page backend endpoint).

### Files Changed (4)
| File | Action | Est. Lines |
|------|--------|------------|
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.ts` | Modify | +684 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.html` | Modify | +240 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.css` | Modify | +638 |
| `frontend/src/app/services/api.service.ts` | Modify | +63 |

### Estimated Lines
+200 / -0 (+63 actual, combined with 3.2-3.5)

### Acceptance Criteria
- [x] State machine with explicit states IDLE → FETCHING → PREVIEW → MAPPING → SCRAPING → DONE | ERROR
- [x] URL input renders in IDLE state with "Fetch Page" button
- [x] "Fetch Page" → transitions to FETCHING (spinner, inputs disabled)
- [x] Polls `GET /api/fetch-page/:id` every 2s until completed or failed
- [x] On success → transitions to PREVIEW with stored HTML + detectedElements
- [x] On error → ERROR state with message + "Retry" button (returns to IDLE)
- [x] ERROR state reachable from any async operation
- [x] `api.service.ts` has `fetchPage(url)` and `getFetchResult(id)` methods

---

## Task 3.2 — Sandboxed HTML Preview with srcdoc Iframe + Click Handlers  [x]

### Description
Render sanitized HTML inside a sandboxed iframe using `srcdoc`. Inject JavaScript that:
1. Highlights hovered elements (blue outline)
2. On click: extracts element tag, text, attributes, generates a unique CSS selector (via document path or id/class combination)
3. Sends element info via `postMessage` to parent
4. Parent (VisualMapperComponent) listens for `message` events and stores clicked element info

Iframe sandbox attributes: `allow-scripts` only (no `allow-same-origin`).

### Dependencies
3.1 (PREVIEW state, HTML stored).

### Files Changed (2)
| File | Action | Est. Lines |
|------|--------|------------|
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.ts` | Modify | +60 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.html` | Modify | +30 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.css` | Modify | +30 |

### Estimated Lines
+120 / -0

### Acceptance Criteria
- [x] HTML rendered in `<iframe sandbox="allow-scripts" srcdoc="...">`
- [x] Scripts stripped from HTML before rendering (if any)
- [x] Hovered elements show blue outline
- [x] Click on element → sends postMessage with `{ tag, text, selector, attributes }`
- [x] Parent component receives message stores current selection
- [x] Iframe sandbox prevents network requests and same-origin access
- [x] No XSS vector: srcdoc content is sanitized

---

## Task 3.3 — Click-to-Select Overlay with Field Assignment  [x]

### Description
When user clicks an element in the iframe: show a floating dropdown menu (positioned near the click point) listing all canonical fields (title, price, imageUrl, sku, currency, description, category). User selects a field → field is marked as assigned with its selector chip visible in the sidebar. Clicking an already-assigned element shows "unassign" option. Sidebar shows all 7 canonical fields + their assigned selector text. "Save & Scrape" enables only when title + price + container are assigned.

### Dependencies
3.2 (click interaction via postMessage).

### Files Changed (1)
| File | Action | Est. Lines |
|------|--------|------------|
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.ts` | Modify | +100 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.html` | Modify | +30 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.css` | Modify | +20 |

### Estimated Lines
+150 / -0

### Acceptance Criteria
- [x] Clicking element in iframe shows floating dropdown with field list
- [x] Selecting a field → sidebar shows field label + selector chip
- [x] Field chip includes remove button
- [x] Same element clicked again → "unassign" option
- [x] Sidebar shows all 7 fields, assigned ones with green indicator
- [x] "Save & Scrape" button disabled until title + price + container assigned
- [x] fieldMappings array built correctly: `[{ canonicalField, selector, type, attribute? }]`

---

## Task 3.4 — Container Selector Detection + Limit Input  [x]

### Description
Add container selector input: user can mark one of the selected elements as "product container" via a dedicated option in the dropdown. When container is selected, highlight all matching elements in the iframe with green outline and show count ("24 elements match"). Add product limit number input (default 20, max 100). Store containerSelector + productLimit in component state.

### Dependencies
3.1 (sidebar, MAPPING state).

### Files Changed (1)
| File | Action | Est. Lines |
|------|--------|------------|
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.ts` | Modify | +30 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.html` | Modify | +20 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.css` | Modify | +10 |

### Estimated Lines
+60 / -0

### Acceptance Criteria
- [x] "Container" option in field dropdown marks element as container
- [x] Container selector stored separately from fieldMappings
- [x] All matching elements highlighted in iframe with green outline
- [x] Match count displayed ("N elements found")
- [x] Product limit input (number, default 20, min 1, max 100)
- [x] containerSelector + productLimit included in save payload

---

## Task 3.5 — Save Domain Rule → Trigger Scrape → Poll Results  [x]

### Description
"Save & Scrape" button (enabled when title + price + container assigned):
1. `POST /api/domains` → saves DomainRule with fieldMappings, containerSelector, productLimit
2. On success: `POST /api/scrape-listing` → triggers listing scrape with new domainRuleId
3. Transitions to SCRAPING state, polls `GET /api/scraping-jobs/:id` every 3s (max 20 attempts)
4. On completion (DONE): shows success message + link to `/products`
5. On failure: transitions to ERROR

Add `createDomain()` and `scrapeListing()` to ApiService.

### Dependencies
1.3 (scrape-listing endpoint), 3.3 (fieldMappings assembled), 3.4 (container + limit).

### Files Changed (3)
| File | Action | Est. Lines |
|------|--------|------------|
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.ts` | Modify | +40 |
| `frontend/src/app/pages/visual-mapper/visual-mapper.component.html` | Modify | +20 |
| `frontend/src/app/services/api.service.ts` | Modify | +20 |

### Estimated Lines
+80 / -0

### Acceptance Criteria
- [x] "Save & Scrape" enabled only when title + price + container assigned
- [x] DomainRule created via POST /api/domains with fieldMappings JSON
- [x] On domain rule save success → POST /api/scrape-listing with domainRuleId
- [x] Transitions to SCRAPING state with spinner
- [x] Polls job status every 3s, max 20 attempts
- [x] On complete → DONE state with success message + link to /products
- [x] On error → ERROR state with message + retry
- [x] `api.service.ts` has `createDomain(domainRule)` and `scrapeListing(domainRuleId, url, limit)`

---

## Task 4.1 — Route Replacement: Remove UrlInput + Default to VisualMapper

### Description
Replace default route from `/url-input` to `/visual-mapper` (or `/`). Remove UrlInputComponent import from app.routes.ts. Delete `frontend/src/app/pages/url-input/` directory entirely. Verify no other module imports UrlInputComponent.

### Dependencies
3.5 (visual mapper fully functional, replaces url-input).

### Files Changed (5)
| File | Action | Est. Lines |
|------|--------|------------|
| `frontend/src/app/app.routes.ts` | Modify | -4, +3 |
| `frontend/src/app/pages/url-input/url-input.component.ts` | **Delete** | -9 |
| `frontend/src/app/pages/url-input/url-input.component.html` | **Delete** | -30 |
| `frontend/src/app/pages/url-input/url-input.component.css` | **Delete** | -20 |
| `frontend/src/app/app.config.ts` | Modify (if needed) | — |

### Estimated Lines
+5 / -80

### Acceptance Criteria
- [ ] `/` route renders VisualMapperComponent directly (no redirect)
- [ ] `/url-input` route removed (returns 404 or redirects)
- [ ] `url-input/` directory deleted
- [ ] No dangling imports of UrlInputComponent
- [ ] App compiles without errors

---

## Task 4.2 — Verify Backward Compatibility

### Description
Verify existing functionality still works:
1. Old DomainRules (with selector*, no fieldMappings) can still be read/updated via existing endpoints
2. Existing single-URL scraping still works via `POST /api/scraping-jobs`
3. Products page still renders correctly
4. Worker still processes single-URL jobs from `scraping_jobs` queue
5. Existing products remain accessible

### Dependencies
4.1 (routes cleaned up).

### Files Changed
None (verification only).

### Estimated Lines
0

### Acceptance Criteria
- [ ] Old DomainRules render in API responses (backend fallback to selector* columns)
- [ ] `POST /api/scraping-jobs` with old-style DomainRule ID works
- [ ] Worker processes single-URL jobs without regression
- [ ] Products page loads existing products successfully
- [ ] All existing tests pass (if any)
- [ ] No console errors on initial page load
