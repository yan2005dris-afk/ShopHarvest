# Spec — aliexpress-real-scraper

## 1. Objective

Replace the legacy `aliexpress.ts` demo scraper (which targeted `books.toscrape.com`) with a native `AliExpressAdapter` that scrapes the real `aliexpress.com` marketplace via Playwright + `BrowserFactoryService`, handling i18n/geo redirects, lazy-loaded results, and transient anti-bot failures with bounded retries.

## 2. Scope

### In

- Native adapter under `backend/src/modules/pipeline/scraping/aliexpress.ts`.
- Playwright Chromium launch through `BrowserFactoryService` (stealth always on, proxy opt-in).
- Real target `aliexpress.com` with i18n/geo handling (region, currency).
- Lazy-load discovery via `window.scrollTo` until no new cards appear or a max-scroll cap is hit.
- Retry with exponential backoff on transient errors (network, 403, captcha marker).
- Raw JSON output to `PIPELINE_RAW_DIR`.
- `> 0` items success gate and `EtlRun` row creation via Prisma.

### Out

- `quotes.toscrape.com` / `books.toscrape.com` (any demo fallback). Banned by grep guardrail.
- Replacing MELI's adapter (covered by `mercadolibre-real-scraper`).
- Frontend cron UI changes.

## 3. Functional Requirements

- **ALI-1** The adapter MUST target `aliexpress.com` (real marketplace) and MUST NOT reference `books.toscrape.com` or `quotes.toscrape.com` in any code path, fallback, or default URL.
- **ALI-2** The adapter MUST obtain its Playwright browser from `BrowserFactoryService` and MUST NOT instantiate Chromium directly.
- **ALI-3** The adapter MUST detect the site locale/currency redirect on first navigation and re-navigate to the configured region (e.g. `aliexpress.com` vs `es.aliexpress.com`) before extracting cards.
- **ALI-4** The adapter MUST trigger lazy-load by scrolling the page in increments until either (a) no new cards appear across two consecutive scrolls or (b) a configurable `MAX_SCROLLS` cap is reached, whichever comes first.
- **ALI-5** The adapter MUST retry transient failures (network reset, 403, captcha marker) with exponential backoff up to a configurable `MAX_RETRIES` (default 3) and MUST surface a final failure with the last error context.
- **ALI-6** The adapter MUST persist the raw payload as JSON to `PIPELINE_RAW_DIR` (from `ConfigService`, default `backend/pipeline/raw`) using `path.join` — never `process.cwd()`-relative hardcoded paths.
- **ALI-7** The adapter MUST treat a successful run as one that produces `> 0` items; a run with zero items MUST be recorded as `failed` in `public.EtlRun` with an explanatory error message.
- **ALI-8** The adapter MUST create/update a single `EtlRun` row (status `running` → `success`/`failed`) via Prisma for every execution.

## 4. Non-Functional Requirements

- Browser launches MUST reuse the singleton `BrowserFactoryService` so `chromium.use(stealth())` registration runs once per process.
- All log lines MUST go through NestJS `Logger` (`this.logger` from the adapter or service), not `console.log`.
- Image, CSS, and font requests SHOULD be aborted via `route.abort()` to control bandwidth on VPS instances.
- Adapter MUST be callable as a CLI (`if (require.main === module)` block) for single-source re-runs.

## 5. Scenarios

### 5.1 Real target instead of books.toscrape.com

**Given** the adapter is invoked for the AliExpress source
**When** the adapter builds its initial URL
**Then** the URL host MUST be `aliexpress.com` (or its `es.`/`www.` variant), and a grep across `backend/` for `books.toscrape.com` and `quotes.toscrape.com` returns zero hits in any AliExpress file.

### 5.2 Browser comes from BrowserFactoryService

**Given** the adapter needs a Playwright page
**When** it acquires a browser context
**Then** it MUST call `BrowserFactoryService.launch()` (or a typed wrapper) and MUST NOT call `chromium.launch()` / `playwright.chromium.launch()` directly. The resulting browser MUST have `puppeteer-extra-plugin-stealth` applied.

### 5.3 Retry with backoff on transient 403

**Given** the first navigation attempt returns HTTP 403
**When** the adapter catches the error
**Then** it MUST sleep with exponential backoff (e.g. 1s → 2s → 4s) and retry, up to `MAX_RETRIES`. If all retries fail, the adapter MUST record the EtlRun as `failed` with the last error message and the attempt count.

### 5.4 > 0 items success gate

**Given** the adapter finishes extraction
**When** it counts extracted items
**Then** if `count > 0` the EtlRun MUST be marked `success`; if `count === 0` the EtlRun MUST be marked `failed` with an error like `"ali: 0 items extracted"` and the raw payload MUST still be persisted for inspection.

### 5.5 Lazy-load scrolls exhausted without results

**Given** the page lazy-loads cards as the user scrolls
**When** the adapter scrolls incrementally and reaches `MAX_SCROLLS`
**Then** extraction proceeds against the cards loaded so far and the count is evaluated against the `> 0` gate. The adapter MUST NOT block forever on infinite scroll.
