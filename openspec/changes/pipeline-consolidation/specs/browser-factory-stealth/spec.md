# Spec — Browser Factory Stealth

## 1. Objective

`BrowserFactoryService` MUST be a NestJS-injectable, process-singleton service that launches a Playwright browser instance via `playwright-extra` with the `puppeteer-extra-plugin-stealth` plugin always registered, and that attaches a residential proxy ONLY when `SCRAPER_PROXY_SERVER` is set in the application configuration. The service MUST be the single source of truth for browser launch behavior consumed by the MELI and AliExpress adapters.

## 2. Scope

### In

- Implementing `BrowserFactoryService` as a `@Injectable()` service inside `backend/src/modules/pipeline/scraping/browser-factory.service.ts`.
- Registering `puppeteer-extra-plugin-stealth` exactly once per process (singleton registration semantics).
- Reading `SCRAPER_PROXY_SERVER`, `SCRAPER_PROXY_USERNAME`, `SCRAPER_PROXY_PASSWORD`, and `SCRAPER_HEADLESS` from `ConfigService`.
- Logging the literal text `"WITHOUT proxy"` when no proxy is attached and `"WITH proxy <server>"` when one is attached.
- Selecting rotating vs sticky proxy username based on the call site's `opts.stickySession` flag.
- Injecting `BrowserFactoryService` into the MELI and AliExpress adapters only, via `PipelineModule.providers`.

### Out

- Proxy vendor selection, subscription, or billing integration.
- A Playwright upgrade for Temu or Shein.
- Worker / Crawlee integration.
- CLI entry points that bypass NestJS DI.
- Any frontend change.

## 3. Functional Requirements

- **BFS-1** `BrowserFactoryService` MUST be declared with `@Injectable()` and registered in `PipelineModule.providers`. The service MUST be supplied as a singleton for the lifetime of the process.
- **BFS-2** On first registration (module init or first `launch()` call), the service MUST register `puppeteer-extra-plugin-stealth` against `playwright-extra` exactly once. Subsequent calls MUST NOT re-register the plugin.
- **BFS-3** If `SCRAPER_PROXY_SERVER` is unset, empty, or undefined, the launched browser MUST NOT route traffic through any proxy. The service MUST emit a log line containing the literal text `"WITHOUT proxy"` (case-sensitive, ASCII) before returning the launched browser.
- **BFS-4** If `SCRAPER_PROXY_SERVER` is set, the launched browser MUST route through that proxy server. The `SCRAPER_PROXY_USERNAME` template MUST be expanded as follows: when the caller passes `opts.stickySession: true`, the `{session}` placeholder MUST be replaced by a stable session id; otherwise the `{session}` placeholder MUST be stripped (rotating mode per launch). The service MUST emit a log line containing `"WITH proxy <server>"` before returning the browser.
- **BFS-5** The MELI and AliExpress adapters are the only adapters allowed to inject `BrowserFactoryService`. The Temu and Shein adapters MUST NOT inject, import, or otherwise reference `BrowserFactoryService`, and MUST NOT receive it via constructor injection in `PipelineModule`.
- **BFS-6** The service MUST honor `SCRAPER_HEADLESS` (default `true`) when launching the browser.
- **BFS-7** If `SCRAPER_PROXY_SERVER` is set but `SCRAPER_PROXY_USERNAME` or `SCRAPER_PROXY_PASSWORD` is missing, the service MUST throw a descriptive configuration error BEFORE launching the browser. No partially-proxied launches MAY occur.

## 4. Non-Functional Requirements

- Logging output MUST go through the NestJS `Logger` (or a wrapper of it), not `console.log`.
- Stealth registration MUST be idempotent: a second invocation in the same process MUST be a no-op, observable through a unit test that calls the registration entry point twice and asserts a single registration side effect.
- The service MUST be unit-testable with `playwright-extra` mocked or stubbed — no real browser launches in unit tests.
- Browser handle lifecycle: the service MUST provide a way to release the underlying browser so that Chromium child processes do not leak across scheduler invocations.
- Module init vs lazy init: the registration point MUST be safe whether invoked at module construction time or first `launch()`, so the service works in both eager and lazy module bootstraps.

## 5. Scenarios

### 5.1 BFS-S1 — Empty proxy env launches a non-proxied browser

**Given** `SCRAPER_PROXY_SERVER` is empty or unset in the application configuration  
**When** `BrowserFactoryService.launch()` is called  
**Then** the returned browser MUST NOT route any traffic through a proxy  
**And** the service MUST emit a log line containing the literal text `"WITHOUT proxy"`

### 5.2 BFS-S2 — Set proxy env launches a proxied browser with rotating or sticky username

**Given** `SCRAPER_PROXY_SERVER` is set, `SCRAPER_PROXY_USERNAME` contains the `{session}` placeholder, and `SCRAPER_PROXY_PASSWORD` is set  
**When** `BrowserFactoryService.launch()` is called without `opts.stickySession` (or with `opts.stickySession: false`)  
**Then** the launched browser MUST route through the configured proxy  
**And** the `{session}` placeholder MUST be stripped from the username used at launch time (rotating mode)  
**And** the service MUST emit a log line containing `"WITH proxy <server>"`

**When** `BrowserFactoryService.launch()` is called with `opts.stickySession: true`  
**Then** the launched browser MUST route through the configured proxy with sticky-session semantics  
**And** the `{session}` placeholder MUST be replaced with a stable session id in the username used at launch time

### 5.3 BFS-S3 — Stealth plugin registered exactly once per process

**Given** the service has been instantiated in a single Node.js process  
**When** the registration entry point is invoked a second time  
**Then** `playwright-extra.use(stealth)` MUST NOT be called again  
**And** the unit test MUST observe a single registration side effect (e.g., a single `use()` invocation)

### 5.4 BFS-S4 — Temu and Shein adapters do not touch the BrowserFactoryService

**Given** the Temu and Shein adapters import their native modules under `backend/src/modules/pipeline/scraping/`  
**When** their source files are inspected  
**Then** neither adapter file MUST contain `BrowserFactoryService` in its import surface  
**And** neither adapter MUST receive `BrowserFactoryService` via constructor injection in `PipelineModule`
