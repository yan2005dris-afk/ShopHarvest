# Proposal: Pipeline Consolidation (Native NestJS Backend)

## Intent

Consolidate all scraping, staging, quality, and DW-load logic — currently scattered under `legacy/pipeline/scripts/` and reached only through a broken runtime bridge — into the NestJS backend as native, statically-imported TypeScript. This change retires the `pipeline-scripts-bridge.ts` runtime-`require` mechanism (which points to a non-existent path and uses `eval('require')` + `ts-node` to load `.ts` at runtime), splits the seven sources into two mechanism classes (Playwright + stealth for MELI/AliExpress; Chrome-extension `extension_export.json` consumer for Temu/Shein), and makes the production build runnable as `nest build && node dist` without `ts-node`. Source of truth: `docs/PLAN_CONSOLIDACION_PIPELINE.md` (this proposal references it, does not duplicate it).

## Scope

### In Scope

- **Mechanism split per source**, locked by hard rules (2026-07-08):
  - **MELI** — real target `mercadolibre.com.ec`, Playwright via `BrowserFactoryService`.
  - **AliExpress** — real target `aliexpress.com` (migrate away from `books.toscrape.com` demo), Playwright via `BrowserFactoryService`.
  - **Temu** — consume `extension_export.json` produced by the user's Chrome extension. **No Playwright. No proxy. No demo fallback.**
  - **Shein** — same model as Temu: extension export consumer only.
  - **ExchangeRates** — real API call via axios. Preserved.
  - **CSV Dataset** — file loader via `csv-parse`. Preserved.
  - **Encuesta** — file loader with anonymization. Preserved.
- **Bridge elimination**: remove `pipeline-scripts-bridge.ts` and every `ts-node`/`eval('require')` reference. Scripts become first-class backend modules under `backend/src/modules/pipeline/scraping/` and `.../etl/`.
- **BrowserFactoryService**: single NestJS-injectable service that centralizes stealth (always on) and residential proxy (only when `SCRAPER_PROXY_SERVER` is set). Consumed by MELI and AliExpress adapters only.
- **Native ETL pipeline**: staging processor, quality service (7 checks + logger), and DW loader migrate from `legacy/pipeline/scripts/{staging,quality,dw}/` to NestJS adapters using Prisma + the existing `IDataSource`/`IStagingProcessor`/`IDwLoader` ports.
- **Two-process model acknowledged**: a process that scrapes (`runScraper`) and a process that loads DW (`loadDw` / staging) are wired by `pipeline.service.ts` against the native adapters; the `etl-scheduler.service.ts` cron remains the production trigger.
- **`legacy/` archive** — preserved as historical evidence of the prior deliverable. Not deleted.
- **Single branch** — all work lands on `feat/bi-dashboard-analytics`, organized as chained PRs grouped by capability (see Approach).

### Out of Scope

- **Cron UI / scheduler configuration in the frontend.** Backend-only change. The `multi-scraper-menus` frontend change handles the scraper control panel separately and is paused until this change lands.
- **Residential proxy subscription / vendor procurement.** The code path is opt-in and ready, but no provider is selected and no proxy is required to ship.
- **Temu/Shein Playwright upgrade.** Documented as a follow-up. Requires residential proxy budget.
- **Changing `@web-scraping/contracts` package layout.** The package is restored to the workspace locally (currently deleted from disk but present in git HEAD) so the backend can import `@web-scraping/contracts/pipeline`. Its directory structure stays as-is.
- **Frontend changes of any kind.**
- **Modifying `public.EtlRun` schema.** State semantics stay 4-valued (`queued` / `running` / `success` / `failed`) — see Risks for why.
- **DB migrations on the analytics/DW schema.** Existing Prisma schema and `dw.dim_fuente.nombre_fuente` values stay intact; `PipelineSource` enum values are preserved exactly.

## Capabilities

### New Capabilities

- `pipeline-bridge-elimination`: retire `pipeline-scripts-bridge.ts` and its `eval('require')` + `ts-node` runtime; every legacy script becomes a native, statically-imported backend module compiled by `nest build`.
- `browser-factory-stealth`: a single `BrowserFactoryService` injects Playwright with `puppeteer-extra-plugin-stealth` always on, and attaches the residential proxy only when `SCRAPER_PROXY_SERVER` is set; consumed by MELI/AliExpress adapters.
- `mercadolibre-real-scraper`: native `MercadoLibreAdapter` that scrapes `mercadolibre.com.ec` via Playwright + `BrowserFactoryService`, with retry/backoff and metrics — no bridge, no demo.
- `aliexpress-real-scraper`: native `AliExpressAdapter` that scrapes `aliexpress.com` (real target, replacing the `books.toscrape.com` demo), Playwright + stealth, proxy opt-in.
- `extension-based-sources`: native `TemuAdapter` and `SheinAdapter` that consume `extension_export.json` produced by the user's Chrome extension; **zero demo fallback** — missing/invalid export raises an explicit error.

### Modified Capabilities

- `etl-staging-dw-native`: staging processor (`stg_*` helpers), quality service (`quality_checks` + logger), and DW loader (`dw_load_staging`) move from `legacy/pipeline/scripts/{staging,quality,dw}/` into NestJS-native adapters and services under `backend/src/modules/pipeline/etl/`, using Prisma + the existing `IStagingProcessor` / `IDwLoader` ports.

## Approach

- **One branch, many PRs.** Stay on `feat/bi-dashboard-analytics` and ship as a chained PR sequence grouped by capability:
  1. `pipeline-bridge-elimination` (foundational — must land first or any later PR still goes through the broken bridge).
  2. `browser-factory-stealth` (shared infra for MELI + AliExpress).
  3. `mercadolibre-real-scraper` + `aliexpress-real-scraper` (Playwright sources, can land in either order once #2 is in).
  4. `extension-based-sources` (Temu + Shein — independent of Playwright work).
  5. `etl-staging-dw-native` (downstream of #1; consumes native raw output).
- **Hexagonal architecture preserved.** Each adapter implements an `IDataSource` (or `IStagingProcessor` / `IDwLoader`) port and is wired through DI tokens (`DATA_SOURCES`, `STAGING_PROCESSOR`, `DW_LOADER`). The bridge disappears; no DI surface change is needed.
- **Stealth by default, proxy opt-in.** `BrowserFactoryService.launch()` reads `SCRAPER_PROXY_SERVER` from `ConfigService`. If empty/undefined → no proxy, only stealth. If set → proxy attached with rotating username (`{session}` placeholder expanded to `-session-<id>` for sticky flows, otherwise rotating). Default behavior works on MELI/AliExpress without any proxy vendor.
- **Zero demo fallback — enforced by review.** A reviewer-checked grep across the backend must return zero hits for `quotes.toscrape.com` and `books.toscrape.com` after Temu/Shein/AliExpress migrations land. CI guardrail to be added.
- **Real-target verification per scraper.** Each Playwright adapter must extract `> 0` items from a controlled run against its real target; Temu/Shein must process a real `extension_export.json` end-to-end (raw → staging → DW).
- **Output paths via config, not `process.cwd()`.** `PIPELINE_RAW_DIR` and `PIPELINE_STAGING_DIR` env vars drive where raw/staging JSON lands; no hardcoded `process.cwd()` paths in the consolidated adapters.
- **CLI self-execution stays.** Legacy scripts that dual-purposed as `npx ts-node ...` CLI tools get the same affordance on the native modules (a small `if (require.main === module)` block at the bottom) so operators can re-run a single source without spinning up the backend.

## Affected Areas

Reference: `docs/PLAN_CONSOLIDACION_PIPELINE.md` §4 (Fases) and §5 (BrowserFactoryService).

| Area | Impact | Description |
| ------ | -------- | ------------- |
| `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` | **Deleted** | Retired. Every `runXxxScrape` and `runEtlScript` wrapper disappears. |
| `backend/src/modules/pipeline/adapters/data-sources/*.adapter.ts` (×7) | **Modified** | Each thin adapter (`meli`, `ali`, `temu`, `shein`, `api-rates`, `csv`, `encuesta`) imports its native module statically instead of calling the bridge. |
| `backend/src/modules/pipeline/scraping/mercadolibre.ts` | **New (moved)** | Port of `legacy/pipeline/scripts/scraping/mercadolibre.ts` + `_base.ts` helpers (`saveToRaw`, `logError`, `randomDelay`, `USER_AGENT`) — uses `BrowserFactoryService`. |
| `backend/src/modules/pipeline/scraping/aliexpress.ts` | **New (moved + retargeted)** | Port of legacy `aliexpress.ts`, retargeted from `books.toscrape.com` → `aliexpress.com`. |
| `backend/src/modules/pipeline/scraping/exchange-rates.ts` | **New (moved)** | Native axios-based API consumer; `API_KEY` from `ConfigService`. |
| `backend/src/modules/pipeline/scraping/temu.ts` + `shein.ts` | **New (moved + rewritten)** | Read `extension_export.json` only. `quotes.toscrape.com` and `quotes.toscrape.com/login` fallbacks **removed**. Missing/invalid export → explicit error. |
| `backend/src/modules/pipeline/scraping/csv-loader.ts` + `encuesta-loader.ts` | **New (moved)** | File loaders via `csv-parse`. Encuesta preserves anonymization. |
| `backend/src/modules/pipeline/scraping/browser-factory.service.ts` | **New** | Centralizes `playwright-extra` + `puppeteer-extra-plugin-stealth`, proxy from `ConfigService` (`SCRAPER_PROXY_SERVER`). |
| `backend/src/modules/pipeline/etl/staging-processor.service.ts` | **New** | Replaces `legacy/pipeline/scripts/staging/run_all.ts` + `stg_*` helpers. Implements `IStagingProcessor`. |
| `backend/src/modules/pipeline/etl/quality.service.ts` | **New** | Replaces `legacy/pipeline/scripts/quality/quality_checks.ts` + `logger.ts`. Uses NestJS `Logger`. Implements the 7 quality checks. |
| `backend/src/modules/pipeline/etl/dw-loader.service.ts` | **New** | Replaces `legacy/pipeline/scripts/dw/dw_load_staging.ts` + `dw_schema.sql`. Implements `IDwLoader` using Prisma. |
| `backend/src/modules/pipeline/adapters/staging-processor.adapter.ts` | **Modified** | Delegates to `etl/staging-processor.service.ts`. |
| `backend/src/modules/pipeline/adapters/dw-loader.adapter.ts` | **Modified** | Delegates to `etl/dw-loader.service.ts`. |
| `backend/src/modules/pipeline/pipeline.module.ts` | **Modified** | Register `BrowserFactoryService`, `QualityService`, and the three ETL services in `providers`. No token change. |
| `backend/src/modules/pipeline/etl-scheduler.service.ts` | **Modified** | Cron stays; ensure it triggers native adapters end-to-end. |
| `backend/src/modules/pipeline/interfaces/` | **Unchanged** | Existing port interfaces (`IDataSource`, `IStagingProcessor`, `IDwLoader`) and `SourceConfig` / `ScrapeResult` / `StagingResult` / `LoadResult` types stay. |
| `backend/package.json` | **Modified** | Add: `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `axios`, `csv-parse`. |
| `packages/contracts/` | **Restored** | Restore the package locally (present in git HEAD, deleted from disk). Imports stay `from '@web-scraping/contracts/pipeline'`. |
| `legacy/pipeline/scripts/` | **Removed** | Contents migrated into `backend/src/modules/pipeline/{scraping,etl}/`. The folder itself is deleted; `legacy/` directory stays as archived evidence. |
| `legacy/pipeline/scripts/scraping/temu.ts`, `shein.ts`, `aliexpress.ts` | **Removed** | `quotes.toscrape.com` / `books.toscrape.com` references must not survive the migration. |
| `.env` (backend) | **Modified** | New variables: `SCRAPER_PROXY_SERVER`, `SCRAPER_PROXY_USERNAME`, `SCRAPER_PROXY_PASSWORD`, `SCRAPER_HEADLESS`, `PIPELINE_RAW_DIR`, `PIPELINE_STAGING_DIR`. |
| `README.md` (backend) | **Modified** | Document the Temu/Shein flow: (1) install Chrome extension → (2) scrape Temu/Shein manually → (3) extension writes `extension_export.json` → (4) backend adapter consumes it. |
| `openspec/changes/multi-scraper-menus/` | **Unchanged** | Frontend change remains paused; this proposal does not touch it. |

## Risks

| Risk | Likelihood | Mitigation |
| ------ | ------------ | ------------ |
| **`EtlRun` state mismatch (4 values in DB vs 3 states in legacy).** Existing DB rows are `queued` / `running` / `success` / `failed`. Legacy ETL scripts surface only `completado` / `fallido` plus an implicit "running". Any migration of the staging/DW code that drops a state value will fail integrity checks. | Medium | Do not modify `public.EtlRun` schema in this change. The native `dw-loader.service.ts` writes the same 4-valued enum via Prisma that the controller already exposes; staging/quality stay internal. `LoadResult.estado` (`completado` / `fallido`) is an adapter-level concept, not a DB row. The mapping is documented in the spec phase. |
| **Polyglot persistence — Playwright vs extension flows.** Two different "scraping" mechanisms live side-by-side. A scheduler failure or an extension export that never arrives is much harder to detect than a Playwright crash (which throws). | Medium | Each source advertises its mechanism in `source-meta.ts` (`playwright` / `extension` / `api` / `file`) so the scheduler and UI can render distinct health states. Temu/Shein failures surface as `failed` EtlRun rows with explicit error messages; missing-export detection runs before the adapter tries to parse, never falls back to demo data. |
| **Scheduler contention under stealth defaults.** `etl-scheduler.service.ts` already limits concurrent jobs, but native Playwright launches are heavier than the previous bridge calls (no `ts-node` startup cost, but real browser launches). Two Playwright jobs running in parallel (MELI + AliExpress) can starve CPU on small VPS instances. | Medium | Schedule MELI and AliExpress on offset cadences (e.g. MELI at `:00`, AliExpress at `:30`) — recommended cadence 6–12h per source. `BrowserFactoryService` is a singleton so the underlying `chromium.use(stealth())` registration runs once per process. Document the cadence in the design phase. |
| **Anti-bot blocks even with stealth.** MELI and AliExpress return 403 / captchas under sustained scraping from a single VPS IP. The plan's stealth-by-default reduces fingerprint surface but does not eliminate IP-based detection. | Medium | Residential proxy is **opt-in** via `SCRAPER_PROXY_SERVER`. When unset, the adapters rely on stealth + retry/backoff. When set, rotating username (`{session}` placeholder unused → rotating per launch) gets a fresh IP each run. Image/CSS/font blocking via `route.abort()` to control bandwidth cost. Spec phase records the exact error-mapping for retries. |
| **`extension_export.json` schema drift.** The Chrome extension team owns the export shape. If `products[]` / `source` / `capturedAt` fields drift, the Temu/Shein adapters silently parse garbage or fail unpredictably. | Medium | Strict schema validation at adapter entry (`zod`-typed or hand-rolled validator) → explicit `BadExtensionExportError`. Adapter fails fast with the parse error in the EtlRun log. The schema is documented in the design phase and pinned in `@web-scraping/contracts` (or a sibling module) so the extension team can sync against it. |
| **Deleting `legacy/pipeline/scripts/` while `legacy/` is archived.** Removing the script files is correct, but the migration must not lose evidence. `legacy/` survives; only `legacy/pipeline/scripts/` is removed. | Low | Plan §7.2 already commits to archiving, not deleting, `legacy/`. The migration deletes only `legacy/pipeline/scripts/{scraping,staging,quality,dw}/`. `legacy/packages/contracts/` and other historical artifacts stay. Pre-commit review must confirm no other path was touched. |
| **`nest build` failures hidden by `ts-node`.** The bridge hid TS errors because `.ts` files were only compiled at runtime. Now that they're part of `nest build`, latent type errors in the legacy scripts will surface. | Medium | Treat the first `nest build` after the bridge deletion as a gate: any compile error is fixed by tightening types (not by adding `@ts-ignore`). Use the existing `pnpm --filter backend build` in CI to block merges. |
| **`@web-scraping/contracts` package missing locally.** The package is deleted from disk but present in git HEAD. The backend cannot import `@web-scraping/contracts/pipeline` until the package is restored. | Low | First step of the first PR (`pipeline-bridge-elimination`) restores the package from git HEAD and verifies `pnpm install` resolves it. Verified in this proposal phase by reading the contract types directly from git. |
| **Playwright native module not installed in container.** `playwright install chromium` is a post-install step that's easy to forget on Docker/CI. | Low | Add `pnpm exec playwright install chromium --with-deps` to the backend Dockerfile and to CI setup. Document in backend README. |

## Rollback Plan

The bridge is the rollback path until **Phase 7** (`etl-staging-dw-native` ships and the bridge is deleted).

- **Pre-Phase-7 (bridge still present):** any failing capability PR can be reverted by `git revert <merge-sha>`. The bridge remains functional on `feat/bi-dashboard-analytics`, so reverting one PR does not break the pipeline — only re-enables the broken `eval('require')` path for that source. Production cron keeps running against the most recent green adapter.
- **Post-Phase-7 (bridge deleted):** rollback requires re-introducing the bridge from git history (`git show HEAD~N:backend/src/modules/pipeline/pipeline-scripts-bridge.ts > ...`), pointing it back at the (now-deleted) `legacy/pipeline/scripts/` paths, and restoring those scripts from `git show`. This is heavy but reversible.
- **Single-capability rollback (preferred):** each capability is its own chained PR, so the cheapest rollback is `git revert` of one PR. The chain order in "Approach" is built so that foundation (`pipeline-bridge-elimination`) and shared infra (`browser-factory-stealth`) land first; later PRs depend on them but not on each other.
- **Data rollback:** no DB migrations in this change. `public.EtlRun` and `public.Product` rows stay. A bad scrape run leaves a `failed` EtlRun with an explicit error — no data corruption.
- **`legacy/` rollback:** until `legacy/pipeline/scripts/` is removed, the rollback is `git checkout HEAD~1 -- legacy/pipeline/scripts/`. Once removed, the folder is gone and the rollback has to come from git history of the previous commit.

## Dependencies

- **Backend `package.json` must add**:
  - `playwright` (or rely on the existing worker dep — confirm before adding).
  - `playwright-extra` (the stealth-friendly wrapper around Playwright).
  - `puppeteer-extra-plugin-stealth` (always-on stealth).
  - `axios` (ExchangeRates + any future HTTP scrapers).
  - `csv-parse` (CSV + Encuesta loaders).
- **Browser binary**: `pnpm exec playwright install chromium` (and `--with-deps` in CI/Docker).
- **`@web-scraping/contracts` package restoration**: currently deleted locally but present in git HEAD. Restore via `git checkout HEAD -- packages/contracts/` and verify `pnpm install` resolves `@web-scraping/contracts/pipeline` from the workspace. The contract types (`PipelineSource`, `ScrapeResult`, `SourceConfig`, etc.) read in this proposal from git are the canonical surface — no shape changes in this change.
- **Environment variables** (added to `backend/.env.example`):
  - `SCRAPER_PROXY_SERVER` (optional, empty by default).
  - `SCRAPER_PROXY_USERNAME` (template; `{session}` placeholder for sticky flows).
  - `SCRAPER_PROXY_PASSWORD`.
  - `SCRAPER_HEADLESS` (default `true`).
  - `PIPELINE_RAW_DIR` (default `backend/pipeline/raw`).
  - `PIPELINE_STAGING_DIR` (default `backend/pipeline/staging`).
- **External coordination — Chrome extension team**: agree the `extension_export.json` schema (`products[]` with `title` / `price` / `currency` / `category` / `url`; top-level `source` and `capturedAt`). The schema is documented in the design phase and pinned in the contracts package so the extension can sync.
- **No frontend changes**: this proposal does not touch `frontend/` or `worker/`. The `multi-scraper-menus` change stays paused.

## Success Criteria

- [ ] MELI adapter extracts `> 0` items from a controlled run against `mercadolibre.com.ec` (real target), uses `BrowserFactoryService`, and persists raw + Prisma.
- [ ] AliExpress adapter extracts `> 0` items from a controlled run against `aliexpress.com` (real target — `books.toscrape.com` is gone), uses `BrowserFactoryService`.
- [ ] Temu and Shein adapters process a real `extension_export.json` end-to-end (raw → staging → DW) with `> 0` items.
- [ ] **Zero demo fallback in code**: grep across `backend/` returns no hits for `quotes.toscrape.com` or `books.toscrape.com`. CI grep guardrail in place.
- [ ] Missing or invalid `extension_export.json` for Temu/Shein produces an explicit `failed` EtlRun with a clear error message — never a fake fill, never a redirect to a demo site.
- [ ] `pnpm --filter backend build && node backend/dist/main.js` runs the pipeline end-to-end without `ts-node`, without `eval('require')`, and without any runtime `.ts` loading.
- [ ] `pipeline-scripts-bridge.ts` and all `ts-node` references are deleted from the backend. No new references are introduced.
- [ ] `legacy/pipeline/scripts/` is removed; `legacy/` directory remains as archive.
- [ ] Staging, quality (7 checks), and DW loader are implemented as native NestJS services under `backend/src/modules/pipeline/etl/` and wired through `STAGING_PROCESSOR` / `DW_LOADER` DI tokens.
- [ ] `BrowserFactoryService` centralizes stealth (always on) and proxy (only when `SCRAPER_PROXY_SERVER` is set). Unit test covers both branches.
- [ ] All existing unit tests in `backend/` pass (`pnpm --filter backend test`); no test regressions.
- [ ] `@web-scraping/contracts/pipeline` is restored locally and the backend imports resolve cleanly without `path` aliases.

## Out of Scope

- Cron UI in the frontend (covered by the paused `multi-scraper-menus` change).
- Residential proxy vendor selection, subscription, or billing.
- Upgrading Temu/Shein to Playwright + residential proxy — documented as a follow-up if/when budget exists.
- Changing the `@web-scraping/contracts` package layout, name, or distribution model.
- Migrating `worker/` (Crawlee-based) — it stays untouched; it does not own the bridge.
- Modifying the public DB schema (`public.EtlRun`, `public.Product`, `dw.*`) — no migrations in this change.
- Frontend, scheduler UI, RBAC, or any UI work.
- Live log streaming from Playwright into the dashboard (out of `multi-scraper-menus` scope too).
