# Spec — MercadoLibre Real Scraper

## 1. Objective

The native `MercadoLibreAdapter` MUST scrape the real Mercado Libre Ecuador storefront at `mercadolibre.com.ec` via Playwright launched exclusively through `BrowserFactoryService`, applying the always-on stealth posture and applying exponential-backoff retries on HTTP 4xx/5xx responses or anti-bot challenges. A controlled run against the real target MUST extract `> 0` items, persist a raw JSON payload under `PIPELINE_RAW_DIR`, and create a `public.EtlRun` row recording items, duration, retry count, and final state. No demo fallback, no bridge.

## 2. Scope

### In

- Implementing `MercadoLibreAdapter` as a NestJS-injectable implementing `IDataSource` for the `meli` source, registered through the existing `DATA_SOURCES` DI token.
- Launching Playwright exclusively via `BrowserFactoryService.launch()` (no direct `playwright.chromium.launch()` in adapter code).
- Building the navigation and product-listing extraction against `mercadolibre.com.ec`.
- Configuring a configurable retry budget (max attempts) with exponential backoff on HTTP 4xx/5xx responses and anti-bot challenges (captcha or block pages).
- Persisting raw JSON under `${PIPELINE_RAW_DIR}/meli/<timestamp>.json` and inserting a `public.EtlRun` row via Prisma in the same logical run.
- Emitting metrics: items extracted, duration (ms), retry count, final state — both on the returned `ScrapeResult` and through the NestJS `Logger`.
- Configuring unit tests for the adapter's retry/metrics logic with `BrowserFactoryService` and Prisma mocked.

### Out

- Demo / fallback scraping against `quotes.toscrape.com`, `books.toscrape.com`, or any non-MELI target.
- The AliExpress, Temu, Shein, ExchangeRates, CSV, or Encuesta adapters (each has its own capability).
- Frontend rendering of MELI runs (covered by `etl-run-history-logs`).
- Modifying the `public.EtlRun` schema (no DB migration in this change).

## 3. Functional Requirements

- **MELI-1** `MercadoLibreAdapter` MUST issue Playwright navigation against `mercadolibre.com.ec`. Any other host (including `quotes.toscrape.com` or `books.toscrape.com`) MUST be a configuration or compile-time error, and a grep guardrail MUST keep such hosts out of the source tree.
- **MELI-2** The adapter MUST launch the browser exclusively through `BrowserFactoryService.launch()`. Direct `playwright.chromium.launch()`, `puppeteer.launch()`, or any equivalent spawn call MUST NOT appear in the adapter source.
- **MELI-3** The adapter MUST retry with exponential backoff on any of: an HTTP 4xx response, an HTTP 5xx response, or an anti-bot challenge (captcha or block page). The number of attempts MUST be configurable via `ConfigService` (default `3`). Backoff MUST start at a configurable base delay (default `1000` ms) and double per attempt up to a configurable cap (default `16000` ms).
- **MELI-4** The adapter MUST emit metrics in the format: `items=<n> duration=<ms> retries=<n> state=<success|failed>` per run. Metrics MUST be available on the `ScrapeResult` return value AND printed through the NestJS `Logger`.
- **MELI-5** Raw JSON output MUST be written under the directory referenced by `PIPELINE_RAW_DIR` (resolved via `ConfigService`). The adapter MUST NOT use `process.cwd()` to compute any output path.
- **MELI-6** Each run (success or failure) MUST result in a `public.EtlRun` row inserted via Prisma, populated per the existing schema: `source = 'meli'`, `state` ∈ `queued | running | success | failed`, `startedAt`, `finishedAt`, and any adapter-level error in the payload. The 4-valued state enum MUST be preserved — no DB migration in this change.
- **MELI-7** A controlled run against `mercadolibre.com.ec` MUST extract `> 0` items from at least one product listing page. This success criterion MUST be observable via a scripted probe or a documented operator command and used as the gate to mark the capability complete.
- **MELI-8** An anti-bot challenge MUST be classified as a retryable condition and MUST NOT be treated as an immediate failure unless the retry budget is exhausted. The captured challenge evidence (status code, page title snippet, or screenshot path) MUST be attached to the eventual `failed` `EtlRun` row's error payload.

## 4. Non-Functional Requirements

- Retry behavior MUST be deterministic: the same input sequence MUST produce the same retry decision and the same exponential schedule.
- The adapter MUST release the Playwright browser handle in a `finally` block, including on success, retry exhaustion, and unexpected error paths. No Chromium child process MAY be left running across scheduler invocations.
- Raw JSON MUST be flushed and synced to disk before the `EtlRun` row is marked `success`.
- Network and IO errors MUST NOT crash the process; they MUST surface as a `failed` `EtlRun` row with a descriptive error message.
- The adapter MUST be unit-testable with `BrowserFactoryService` mocked and Prisma's `etlRun.create` mocked — no real Playwright launch in unit tests.
- Observability: an HTTP-level error mapping table (4xx / 5xx / captcha → retryable or terminal) MUST exist as documented behavior, observable through unit tests.

## 5. Scenarios

### 5.1 MELI-S1 — Adapter targets the real Mercado Libre Ecuador storefront

**Given** a configured run of `MercadoLibreAdapter` for source `meli`  
**When** the adapter navigates the Playwright page  
**Then** the requested URL MUST belong to the `mercadolibre.com.ec` host  
**And** no request MUST be issued against `books.toscrape.com`, `quotes.toscrape.com`, or any other demo/non-MELI target

### 5.2 MELI-S2 — Retry with exponential backoff on 4xx/5xx or anti-bot challenge

**Given** the configured max attempts is `3` and the base backoff is `1000` ms  
**When** the adapter receives an HTTP 429 response or detects an anti-bot challenge on the first attempt  
**Then** the adapter MUST sleep approximately `1000` ms before attempt 2  
**And** the adapter MUST sleep approximately `2000` ms before attempt 3 if attempt 2 also fails  
**And** the adapter MUST stop retrying after attempt 3 and surface a `failed` `EtlRun` row with the captured error  
**And** the `retries` field on the resulting `ScrapeResult` MUST equal the number of additional attempts performed

### 5.3 MELI-S3 — Adapter logs items extracted, duration, retry count, and final state

**Given** a successful run extracts 7 items in 12 345 ms with zero retries  
**When** the adapter returns the `ScrapeResult` and emits its `Logger` output  
**Then** the `ScrapeResult` MUST carry `items=7`, `durationMs=12345`, `retries=0`, `state='success'`  
**And** the `Logger` output MUST contain a tokenized metric line with `items=7`, `duration=12345`, `retries=0`, and `state=success`

### 5.4 MELI-S4 — Output paths use PIPELINE_RAW_DIR, not process.cwd()

**Given** `PIPELINE_RAW_DIR=/var/data/pipeline/raw` in the application configuration  
**When** `MercadoLibreAdapter` persists its raw JSON for a run  
**Then** the file MUST be written under `/var/data/pipeline/raw/meli/`  
**And** no path in the adapter MUST be derived from `process.cwd()`

### 5.5 MELI-S5 — Adapter persists raw JSON and a Prisma EtlRun row

**Given** a successful adapter run extracting `> 0` items  
**When** the run completes  
**Then** a JSON file MUST exist under `${PIPELINE_RAW_DIR}/meli/<timestamp>.json` whose contents match the items extracted  
**And** a row MUST be inserted into `public.EtlRun` with `source='meli'`, `state='success'`, the recorded `startedAt`/`finishedAt`, and an items metric that mirrors the file

**Given** a failed adapter run exhausting its retry budget  
**When** the run terminates  
**Then** a row MUST be inserted into `public.EtlRun` with `source='meli'`, `state='failed'`, and a descriptive error message in the adapter-level payload  
**And** the raw JSON file MAY be absent or partial — the failure row carries the canonical error description
