# Tasks — Pipeline Consolidation

## Overview

This change consolidates the legacy `pipeline/scripts/` runtime-bridge into the NestJS backend as statically-imported TypeScript. The work is delivered as **8 chained PRs** on branch `feat/bi-dashboard-analytics`, ordered so each PR compiles green on its own and the rollback path is `git revert <merge-sha>` per PR until PR 6 lands (after which rollback is heavier but still possible via `git show HEAD~N`).

**Total estimated effort:** ~1,930 new/modified lines across 30 files in `backend/` plus ~30 lines of `package.json` changes (from `design.md` §3 grand total). Six of the eight PRs land under the 400-line soft cap; **PR 5 (~565 lines)** and **PR 6 (~890 lines)** stay unified per the user's 2026-07-08 decision and exceed the cap. PR 1 was split defensively into **1a (bridge deletion + CI guardrail, ~−115 net)** and **1b (native stubs + adapter rewrites + `legacy/` cleanup, ~+295 / −600)** so review batches are bounded.

### Key gates (must pass before any PR merges)

1. **CI grep guardrail** — `.github/workflows/ci.yml` step fails the build on any hit for `quotes.toscrape.com`, `books.toscrape.com`, `ts-node`, or `eval('require')` inside `backend/src/` or `legacy/` (added in PR 1a; enforced from PR 1a onward).
2. **Build + boot smoke** — `pnpm --filter backend build && node backend/dist/main.js --smoke-run` exits 0, confirming the bridge is gone and all DI bindings resolve (gate added in PR 1a; enforced from PR 1a onward).
3. **`EtlRun` 4-state preserved** — Native services write the same `queued | running | success | failed` enum values the DB already holds; no Prisma migration is generated (enforced by ETL unit test in PR 6).
4. **Real-target verification per scraper** — MELI extracts `> 0` items from `mercadolibre.com.ec` (PR 3), AliExpress from `aliexpress.com` (PR 4), Temu/Shein from a real `extension_export.json` (PR 5).

### Spec traceability

| Spec ID range | Spec file | First PR |
| --- | --- | --- |
| BRG-1 … BRG-9 | `pipeline-bridge-elimination/spec.md` | PR 1a / PR 1b |
| BFS-1 … BFS-7 (+ BFS-S1 … BFS-S4) | `browser-factory-stealth/spec.md` | PR 2 |
| MELI-1 … MELI-8 (+ MELI-S1 … MELI-S5) | `mercadolibre-real-scraper/spec.md` | PR 3 |
| ALI-1 … ALI-8 (+ ALI-S1 … ALI-S5) | `aliexpress-real-scraper/spec.md` | PR 4 |
| EXT-1 … EXT-8 | `extension-based-sources/spec.md` | PR 5 |
| ETL-1 … ETL-7 | `etl-staging-dw-native/spec.md` | PR 6 |

### Hard rules (restated from the proposal)

1. Stealth is **always on**; no env var disables `puppeteer-extra-plugin-stealth` (D2 / BFS-2).
2. Residential proxy is **opt-in**; ships with no vendor and no mandatory subscription (D3 / BFS-3, BFS-4).
3. **`EtlRun` 4-state** (`queued | running | success | failed`) is preserved — no DB migration in this change (D4 / ETL-5).
4. **Zero demo fallback** — grep guardrail in CI blocks `quotes.toscrape.com` and `books.toscrape.com` (D7 / BRG-7 / EXT-4 / EXT-5 / EXT-8).
5. **No browser pool** in `BrowserFactoryService` — singleton is logical, not process-pooling (D1).
6. **`legacy/` is archived**, only `legacy/pipeline/scripts/{scraping,staging,quality,dw}/` is deleted (D6 / BRG-5 / ETL-7).
7. Output paths come from `ConfigService` (`PIPELINE_RAW_DIR`, `PIPELINE_STAGING_DIR`, `EXTENSION_EXPORT_PATH`), never from `process.cwd()` (MELI-5, ALI-6, EXT-1).

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | ~1,960 (≈1,930 backend + ~30 package.json) |
| 400-line budget risk | **Medium** — six PRs within budget, PR 5 (+565) and PR 6 (+890) exceed the 400-line soft cap (unified per user decision 2026-07-08) |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1a → PR 1b → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 |
| Delivery strategy | `ask-on-risk` (PRs 3-6 each at-or-over the 400-line cap; surface on each PR) |
| Chain strategy | `feature-branch-chain` — every PR targets `feat/bi-dashboard-analytics`; only the tracker merges to main |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

> **Reviewer batching notes** (from `design.md` §6): PR 5 review in two passes (contracts batch then adapter batch); PR 6 review in three passes (7 quality checks → quality+staging services → dw-loader + adapter wiring).

---

## PR 1a — Pipeline Bridge Elimination (foundation)

**Goal:** Bridge deleted; `@web-scraping/contracts` restored; CI grep guardrail + build/boot smoke gate in place. Stubs land in PR 1b; this PR can land with empty `scraping/` and `etl/` folders.
**Merge dependencies:** none.
**Estimated net lines:** ~+35 / −150 (from `design.md` §6).

### Tasks

- [ ] **T1a.1** Delete `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` from the repo with `git rm`.
  - Acceptance: `git log --diff-filter=D -- backend/src/modules/pipeline/pipeline-scripts-bridge.ts` shows the deletion; `pipeline-scripts-bridge.ts` no longer appears in `git ls-files`.
  - Spec ref: BRG-1.
  - Files: `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` (DELETED).

- [ ] **T1a.2** Restore the `packages/contracts/` workspace package from git HEAD with `git checkout HEAD -- packages/contracts/` and verify `pnpm install` resolves `@web-scraping/contracts/pipeline`.
  - Acceptance: `pnpm --filter @web-scraping/contracts build` exits 0; from `backend/`, `node -e "require.resolve('@web-scraping/contracts/pipeline')"` exits 0 without path aliases.
  - Spec ref: BRG-8.
  - Files: `packages/contracts/**` (restored).

- [ ] **T1a.3** Drop the bridge import from `backend/src/modules/pipeline/pipeline.module.ts` and `backend/src/modules/pipeline/pipeline.service.ts`; replace any `bridge.runXxxScrape(...)` / `bridge.runEtlScript(...)` calls with stubs that throw `Error('implemented in PR 1b')`.
  - Acceptance: `rg "pipeline-scripts-bridge|require.resolve.*pipeline/scripts" backend/src/` returns zero hits; both files compile under `nest build`.
  - Spec ref: BRG-2, BRG-3.
  - Files: `backend/src/modules/pipeline/pipeline.module.ts`, `backend/src/modules/pipeline/pipeline.service.ts`.

- [ ] **T1a.4** Add a CI grep step to `.github/workflows/ci.yml` named "Pipeline consolidation guardrails" that fails on any hit for `quotes.toscrape.com`, `books.toscrape.com`, `ts-node`, or `eval('require')` inside `backend/src/` and `legacy/`.
  - Acceptance: The step runs `rg` against the listed paths; an intentional re-injection of `books.toscrape.com` into `backend/src/main.ts` causes the step to exit non-zero in a local `act` dry-run.
  - Spec ref: BRG-2, BRG-7.
  - Files: `.github/workflows/ci.yml`.

- [ ] **T1a.5** Add a CI build/boot-smoke step to `.github/workflows/ci.yml` that runs `pnpm --filter backend install --frozen-lockfile && pnpm --filter backend build && node backend/dist/main.js --smoke-run` and asserts exit 0. Add the `--smoke-run` flag to `backend/src/main.ts` so it boots the Nest app, initializes all providers, and exits 0 without triggering the cron.
  - Acceptance: The new flag is wired (no `process.exit` before bootstrap); a local `pnpm --filter backend build && node backend/dist/main.js --smoke-run` exits 0 within 10s and emits one `Nest application successfully bootstrapped` line.
  - Spec ref: BRG-6.
  - Files: `.github/workflows/ci.yml`, `backend/src/main.ts`.

- [ ] **T1a.6** Add empty `.gitkeep` files so `backend/src/modules/pipeline/scraping/` and `backend/src/modules/pipeline/etl/` exist as tracked folders (their modules land in PR 1b / PR 6).
  - Acceptance: `git ls-files backend/src/modules/pipeline/scraping/.gitkeep backend/src/modules/pipeline/etl/.gitkeep` returns both paths.
  - Spec ref: BRG-4 (folder skeleton).
  - Files: `backend/src/modules/pipeline/scraping/.gitkeep`, `backend/src/modules/pipeline/etl/.gitkeep`.

- [ ] **T1a.7** Verify the full local pipeline gate: `pnpm install && pnpm --filter backend build && node backend/dist/main.js --smoke-run` exits 0, and `pnpm --filter backend test` passes with no regressions.
  - Acceptance: Build + smoke + existing unit tests all green; recorded in the PR description.
  - Spec ref: BRG-6.
  - Files: (no new files; verification only).

- [ ] **T1a.8** Commit with conventional message, push the branch, and open the PR titled `chore(pipeline): retire runtime bridge + CI grep guardrail (pipeline-consolidation 1a)`.
  - Acceptance: PR is open against `feat/bi-dashboard-analytics`, CI is green, branch is up to date.
  - Spec ref: BRG-1, BRG-7.
  - Files: PR description + commit history only.

---

## PR 1b — Pipeline Bridge Elimination (scraping module stubs + legacy cleanup)

**Goal:** Land 7 native scraping modules (stubs), wire all 7 adapters to static `import`, delete `legacy/pipeline/scripts/`, add runtime deps. Real implementations come in PR 3 (MELI), PR 4 (AliExpress), PR 5 (Temu/Shein).
**Merge dependencies:** PR 1a.
**Estimated net lines:** ~+295 / −600 (from `design.md` §6).

### Tasks

- [ ] **T1b.1** Create `backend/src/modules/pipeline/scraping/mercadolibre.ts` as a stub exporting `async function scrapeMercadoLibre(): Promise<ScrapeResult>` whose body throws `new Error('not implemented, see PR 3 (mercadolibre-real-scraper)')`.
  - Acceptance: File exists, exports the function with the exact name, `nest build` resolves it.
  - Spec ref: BRG-4.
  - Files: `backend/src/modules/pipeline/scraping/mercadolibre.ts`.

- [ ] **T1b.2** Create `backend/src/modules/pipeline/scraping/aliexpress.ts` as a stub exporting `async function scrapeAliExpress()` with the same "not implemented, see PR 4" message.
  - Acceptance: As T1b.1 with the corresponding name + spec reference ALI-* and PR 4.
  - Spec ref: BRG-4.
  - Files: `backend/src/modules/pipeline/scraping/aliexpress.ts`.

- [ ] **T1b.3** Create `backend/src/modules/pipeline/scraping/temu.ts` as a stub exporting `async function readTemuExtensionExport()` with the "not implemented, see PR 5" message.
  - Acceptance: File exists, exports the function, `nest build` resolves it.
  - Spec ref: BRG-4, EXT-1, EXT-2.
  - Files: `backend/src/modules/pipeline/scraping/temu.ts`.

- [ ] **T1b.4** Create `backend/src/modules/pipeline/scraping/shein.ts` as a stub exporting `async function readSheinExtensionExport()` with the same "see PR 5" message.
  - Acceptance: As T1b.3 with the Shein name.
  - Spec ref: BRG-4, EXT-1, EXT-2.
  - Files: `backend/src/modules/pipeline/scraping/shein.ts`.

- [ ] **T1b.5** Create `backend/src/modules/pipeline/scraping/exchange-rates.ts` as a stub exporting `async function fetchExchangeRates()` with the "not implemented" message; full axios impl lands in this PR (port of legacy).
  - Acceptance: Function exports the API result and `nest build` resolves it; spec reference for the eventual impl: BRG-4 (full impl not deferred — only MELI/AliExpress/Temu/Shein are deferred).
  - Spec ref: BRG-4.
  - Files: `backend/src/modules/pipeline/scraping/exchange-rates.ts`.

- [ ] **T1b.6** Create `backend/src/modules/pipeline/scraping/csv-loader.ts` as a stub exporting `async function loadCsvDataset()` using `csv-parse` (full impl lands in this PR).
  - Acceptance: Stub compiles and resolves.
  - Spec ref: BRG-4.
  - Files: `backend/src/modules/pipeline/scraping/csv-loader.ts`.

- [ ] **T1b.7** Create `backend/src/modules/pipeline/scraping/encuesta-loader.ts` as a stub exporting `async function loadEncuesta()` (full impl lands in this PR; preserves anonymization helper).
  - Acceptance: Stub compiles and resolves.
  - Spec ref: BRG-4.
  - Files: `backend/src/modules/pipeline/scraping/encuesta-loader.ts`.

- [ ] **T1b.8** Create `backend/src/modules/pipeline/scraping/source-meta.ts` exporting `SourceMechanism` type union, `SOURCE_MECHANISM_MAP` with all 7 sources mapped (MELI/Ali = `playwright`, Temu/Shein = `extension`, api_rates = `api`, csv/encuesta = `file`), and a `getMechanism(source)` helper.
  - Acceptance: `rg "extension" backend/src/modules/pipeline/scraping/source-meta.ts` returns hits for `temu` and `shein`; map has exactly 7 entries; constants file is later re-exported by `etl/etl.constants.ts` in PR 6.
  - Spec ref: EXT-7.
  - Files: `backend/src/modules/pipeline/scraping/source-meta.ts`.

- [ ] **T1b.9** Rewrite `backend/src/modules/pipeline/adapters/data-sources/meli.adapter.ts` to statically `import { scrapeMercadoLibre } from '../../scraping/mercadolibre'` and call it; remove any `bridge.runMercadoLibreScrape(...)` reference.
  - Acceptance: The adapter has a single `import` for `mercadolibre`; `rg "bridge" backend/src/modules/pipeline/adapters/data-sources/meli.adapter.ts` returns zero hits.
  - Spec ref: BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/meli.adapter.ts`.

- [ ] **T1b.10** Rewrite `backend/src/modules/pipeline/adapters/data-sources/ali.adapter.ts` to statically import `scrapeAliExpress` from `../../scraping/aliexpress`; remove bridge reference.
  - Acceptance: As T1b.9 with the AliExpress adapter.
  - Spec ref: BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/ali.adapter.ts`.

- [ ] **T1b.11** Rewrite `backend/src/modules/pipeline/adapters/data-sources/temu.adapter.ts` to statically import `readTemuExtensionExport` from `../../scraping/temu`; remove bridge reference and any `quotes.toscrape.com` URL default.
  - Acceptance: Adapter compiles, has a single static import, contains no `quotes.toscrape`/`books.toscrape` literal.
  - Spec ref: BRG-3, EXT-4, EXT-8.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/temu.adapter.ts`.

- [ ] **T1b.12** Rewrite `backend/src/modules/pipeline/adapters/data-sources/shein.adapter.ts` to statically import `readSheinExtensionExport` from `../../scraping/shein`; same constraints as T1b.11.
  - Acceptance: As T1b.11 with the Shein adapter.
  - Spec ref: BRG-3, EXT-4, EXT-8.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/shein.adapter.ts`.

- [ ] **T1b.13** Rewrite `backend/src/modules/pipeline/adapters/data-sources/api-rates.adapter.ts` to statically import `fetchExchangeRates` from `../../scraping/exchange-rates`.
  - Acceptance: Static import only; `nest build` green.
  - Spec ref: BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/api-rates.adapter.ts`.

- [ ] **T1b.14** Rewrite `backend/src/modules/pipeline/adapters/data-sources/csv.adapter.ts` to statically import `loadCsvDataset` from `../../scraping/csv-loader`.
  - Acceptance: As T1b.13 with the CSV adapter.
  - Spec ref: BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/csv.adapter.ts`.

- [ ] **T1b.15** Rewrite `backend/src/modules/pipeline/adapters/data-sources/encuesta.adapter.ts` to statically import `loadEncuesta` from `../../scraping/encuesta-loader`.
  - Acceptance: As T1b.13 with the Encuesta adapter.
  - Spec ref: BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/encuesta.adapter.ts`.

- [ ] **T1b.16** Add runtime deps to `backend/package.json`: `playwright ^1.45`, `playwright-extra ^4.3.6`, `puppeteer-extra-plugin-stealth ^2.11.2`, `axios ^1.7`, `csv-parse ^5.5.6`. Run `pnpm install` and verify `backend/package-lock.json` resolves all five.
  - Acceptance: `cat backend/package.json | jq '.dependencies | keys'` lists all five packages; `pnpm install` exits 0.
  - Spec ref: BRG-4 (deps for the modules).
  - Files: `backend/package.json`, `backend/package-lock.json`.

- [ ] **T1b.17** Update `backend/.env.example` with the six new env vars (`SCRAPER_PROXY_SERVER`, `SCRAPER_PROXY_USERNAME`, `SCRAPER_PROXY_PASSWORD`, `SCRAPER_HEADLESS`, `PIPELINE_RAW_DIR`, `PIPELINE_STAGING_DIR`, plus `EXTENSION_EXPORT_PATH` which PR 5 will read) with comments explaining opt-in semantics.
  - Acceptance: `cat backend/.env.example` shows all seven vars with comments; `rg "^(SCRAPER_|PIPELINE_|EXTENSION_EXPORT_)" backend/.env.example` returns the expected lines.
  - Spec ref: BRG-4 (env surface).
  - Files: `backend/.env.example`.

- [ ] **T1b.18** Delete `legacy/pipeline/scripts/{scraping,staging,quality,dw}/` with `git rm -r`; verify nothing else under `legacy/` was touched (`git status`).
  - Acceptance: `git log --diff-filter=D --stat -- legacy/` shows only the four subfolders deleted; `legacy/` directory still exists.
  - Spec ref: BRG-5.
  - Files: `legacy/pipeline/scripts/scraping/**`, `legacy/pipeline/scripts/staging/**`, `legacy/pipeline/scripts/quality/**`, `legacy/pipeline/scripts/dw/**` (DELETED).

- [ ] **T1b.19** Verify the CI grep guardrail from PR 1a is still green after the legacy deletion: re-run `rg "quotes.toscrape.com|books.toscrape.com|ts-node|eval\('require'\)" backend/src/ legacy/` locally and confirm zero hits.
  - Acceptance: Zero hits across `backend/src/` and `legacy/`; no comments match because legacy is gone.
  - Spec ref: BRG-7, EXT-8.
  - Files: (verification only).

- [ ] **T1b.20** Verify the production build + boot smoke gate still passes: `pnpm --filter backend build && node backend/dist/main.js --smoke-run` exits 0 within 10s.
  - Acceptance: Build + smoke green; adapter rewires resolve at runtime.
  - Spec ref: BRG-6.
  - Files: (verification only).

- [ ] **T1b.21** Commit with conventional message, push, and open PR titled `feat(pipeline): land native scraping module stubs + adapter rewires + legacy cleanup (pipeline-consolidation 1b)`.
  - Acceptance: PR open against `feat/bi-dashboard-analytics`, CI green (gates from PR 1a pass), unit tests pass.
  - Spec ref: BRG-3, BRG-4, BRG-5, BRG-6.
  - Files: PR + commits only.

---

## PR 2 — Browser Factory Stealth (shared infra)

**Goal:** Singleton `BrowserFactoryService` with always-on stealth and proxy opt-in; consumed only by MELI (PR 3) and AliExpress (PR 4) adapters when they land. No adapter uses it yet in this PR.
**Merge dependencies:** PR 1a, PR 1b.
**Estimated net lines:** ~+230 (from `design.md` §6). Single concern, within the 400-line cap.

### Tasks

- [ ] **T2.1** Add `packages/contracts/src/pipeline/browser-factory-options.ts` exporting `interface BrowserFactoryOptions { stickySession?: boolean; viewport?: { width: number; height: number }; userAgent?: string; locale?: string }`.
  - Acceptance: File exists, compiles with `pnpm --filter @web-scraping/contracts build`, exported from `packages/contracts/src/pipeline/index.ts`.
  - Spec ref: BFS-1 (options contract).
  - Files: `packages/contracts/src/pipeline/browser-factory-options.ts`, `packages/contracts/src/pipeline/index.ts`.

- [ ] **T2.2** Re-export `BrowserFactoryOptions` from `packages/contracts/src/pipeline/index.ts` (add `export * from './browser-factory-options';`).
  - Acceptance: `rg "BrowserFactoryOptions" packages/contracts/src/pipeline/index.ts` shows the re-export.
  - Spec ref: BFS-1.
  - Files: `packages/contracts/src/pipeline/index.ts`.

- [ ] **T2.3** Confirm `playwright-extra` and `puppeteer-extra-plugin-stealth` are listed in `backend/package.json` dependencies (added in PR 1b) and pin their versions (`playwright-extra ^4.3.6`, `puppeteer-extra-plugin-stealth ^2.11.2`).
  - Acceptance: `cat backend/package.json | jq '.dependencies | .["playwright-extra"], .["puppeteer-extra-plugin-stealth"]'` shows both pinned versions.
  - Spec ref: BFS-1.
  - Files: `backend/package.json`.

- [ ] **T2.4** Document the `pnpm exec playwright install chromium --with-deps` post-install step in `backend/README.md` and add a one-line `postinstall` script to `backend/package.json` that runs the command so a fresh CI runner gets the binary.
  - Acceptance: `cat backend/README.md | rg "playwright install chromium"` returns the documented line; `cat backend/package.json | jq '.scripts.postinstall'` shows the command.
  - Spec ref: BFS-1 (binary availability).
  - Files: `backend/README.md`, `backend/package.json`.

- [ ] **T2.5** Implement `backend/src/modules/pipeline/scraping/browser-factory.service.ts` as a NestJS `@Injectable()` singleton with `OnModuleInit`, the `ensureStealthRegistered()` guarded by a `Symbol.for('pipeline.stealth.registered')` global, and `launch(opts)` + `newContext(browser, opts)` methods per `design.md` §4 (strips `{session}` when `!opts.stickySession`, throws BEFORE launch if proxy is set without username/password, emits `"WITHOUT proxy"` and `"WITH proxy <server>"` log lines via NestJS `Logger`).
  - Acceptance: `nest build` resolves the file; the singleton `@Injectable()` decoration is present; `Symbol.for` global guard is present; both log strings appear as literal substrings; pre-launch username/password validation throws before `chromium.launch(...)` is called.
  - Spec ref: BFS-1, BFS-2, BFS-3, BFS-4, BFS-6, BFS-7.
  - Files: `backend/src/modules/pipeline/scraping/browser-factory.service.ts`.

- [ ] **T2.6** Register `BrowserFactoryService` in `backend/src/modules/pipeline/pipeline.module.ts` `providers` (no token change — it is injected by type).
  - Acceptance: `rg "BrowserFactoryService" backend/src/modules/pipeline/pipeline.module.ts` shows the provider entry.
  - Spec ref: BFS-1, BFS-5.
  - Files: `backend/src/modules/pipeline/pipeline.module.ts`.

- [ ] **T2.7** Write unit tests in `backend/src/modules/pipeline/scraping/__tests__/browser-factory.service.spec.ts` covering BFS-S1 (`launch()` with empty proxy env emits `"WITHOUT proxy"`), BFS-S2 (`launch()` with `SCRAPER_PROXY_SERVER` set + `{session}` template + `opts.stickySession: true` replaces placeholder; with `stickySession: false/undefined` strips it), BFS-S3 (calling the registration entry point twice invokes `playwright-extra.use(stealth)` exactly once), and BFS-S4 (Temu/Shein adapter files do not reference `BrowserFactoryService`).
  - Acceptance: All four scenarios are described as `it(...)` blocks, `pnpm --filter backend test browser-factory` is green, `jest --coverage` shows the four scenarios executed.
  - Spec ref: BFS-S1, BFS-S2, BFS-S3, BFS-S4.
  - Files: `backend/src/modules/pipeline/scraping/__tests__/browser-factory.service.spec.ts`.

- [ ] **T2.8** Verify `pnpm --filter backend test` is fully green; no regressions in pre-existing tests.
  - Acceptance: `pnpm --filter backend test` exits 0.
  - Spec ref: BFS-1.
  - Files: (verification only).

- [ ] **T2.9** Commit with conventional message, push, and open PR titled `feat(pipeline): BrowserFactoryService singleton with always-on stealth + proxy opt-in (browser-factory-stealth)`.
  - Acceptance: PR open against `feat/bi-dashboard-analytics`, CI green.
  - Spec ref: BFS-1.
  - Files: PR + commits only.

---

## PR 3 — MercadoLibre Real Scraper

**Goal:** Native `MercadoLibreAdapter` targets `mercadolibre.com.ec` via `BrowserFactoryService`, retries + backoff, metrics, raw persistence, Prisma EtlRun row.
**Merge dependencies:** PR 1a, PR 1b, PR 2.
**Estimated net lines:** ~+440 (from `design.md` §6). At the 400-line cap; reviewer may request a follow-up PR for `scraper-metrics.ts` and the unit test if review load is high.

### Tasks

- [ ] **T3.1** Add `packages/contracts/src/pipeline/scraper-metrics.ts` exporting `interface ScraperMetrics { items: number; durationMs: number; retries: number; state: 'success' | 'failed' }`.
  - Acceptance: File compiles; exported from `packages/contracts/src/pipeline/index.ts`.
  - Spec ref: MELI-4 (metrics contract).
  - Files: `packages/contracts/src/pipeline/scraper-metrics.ts`, `packages/contracts/src/pipeline/index.ts`.

- [ ] **T3.2** Re-export `ScraperMetrics` from `packages/contracts/src/pipeline/index.ts`.
  - Acceptance: `rg "ScraperMetrics" packages/contracts/src/pipeline/index.ts` shows the re-export.
  - Spec ref: MELI-4.
  - Files: `packages/contracts/src/pipeline/index.ts`.

- [ ] **T3.3** Replace the stub at `backend/src/modules/pipeline/scraping/mercadolibre.ts` with the full implementation: navigation against `mercadolibre.com.ec`, browser launched through `BrowserFactoryService.launch()`, configurable retry budget (default 3) with exponential backoff (default 1000ms base, doubling, cap 16000ms), anti-bot challenge classifier (HTTP 4xx/5xx, captcha marker → retryable), `window.scrollTo`-style lazy-load handling, and a final `ScrapeResult` populated with `ScraperMetrics`. Log via NestJS `Logger`. Browser released in `finally`.
  - Acceptance: File builds; no `chromium.launch` / `puppeteer.launch` direct calls; `URL` host is `mercadolibre.com.ec`; `EtlRun` row is created via Prisma on every invocation; raw JSON written under `${PIPELINE_RAW_DIR}/meli/<timestamp>.json`.
  - Spec ref: MELI-1, MELI-2, MELI-3, MELI-4, MELI-5, MELI-6, MELI-7, MELI-8.
  - Files: `backend/src/modules/pipeline/scraping/mercadolibre.ts`.

- [ ] **T3.4** Update `backend/src/modules/pipeline/adapters/data-sources/meli.adapter.ts` to wire `ScraperMetrics` into its return value (passing metrics from `scrapeMercadoLibre` up the adapter so the controller exposes them) and to surface the `> 0` items gate as `success` vs `failed` on the EtlRun row.
  - Acceptance: Adapter compiles, returns metrics in its `ScrapeResult` wrapper, fails when `items === 0` (logs `"meli: 0 items extracted"`, marks EtlRun `failed`).
  - Spec ref: MELI-4, MELI-6, MELI-7.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/meli.adapter.ts`.

- [ ] **T3.5** Add unit tests in `backend/src/modules/pipeline/scraping/__tests__/mercadolibre.spec.ts` covering MELI-S1 (host is `mercadolibre.com.ec`, no demo URL), MELI-S2 (3 attempts with `1000ms`/`2000ms` sleeps on the retry budget on 4xx/captcha, then `failed`), MELI-S3 (`items=7 duration=12345 retries=0 state=success` ends up both on `ScrapeResult` and in a `Logger` tokenized line), MELI-S4 (with `PIPELINE_RAW_DIR=/var/data/pipeline/raw` the file lands in `/var/data/pipeline/raw/meli/`), MELI-S5 (success → raw JSON + EtlRun `success` row; failure → EtlRun `failed` with error payload, raw may be absent).
  - Acceptance: All five scenarios have `it(...)` blocks; `pnpm --filter backend test mercadolibre` is green; `BrowserFactoryService` and Prisma's `etlRun.create` are mocked.
  - Spec ref: MELI-S1, MELI-S2, MELI-S3, MELI-S4, MELI-S5.
  - Files: `backend/src/modules/pipeline/scraping/__tests__/mercadolibre.spec.ts`.

- [ ] **T3.6** Add an integration probe script under `backend/scripts/probe-meli.ts` that reads `PIPELINE_RAW_DIR` and one MELI listing URL from env, runs the adapter against a controlled fixture HTML (or against the real target when a probe token is provided), and asserts `items > 0`; document it in `backend/README.md`.
  - Acceptance: `pnpm --filter backend exec ts-node scripts/probe-meli.ts --fixture` exits 0 against the committed fixture and prints the item count; against a real run with `MELI_PROBE_TOKEN` set, exits 0 and writes raw JSON.
  - Spec ref: MELI-7.
  - Files: `backend/scripts/probe-meli.ts`, `backend/README.md`.

- [ ] **T3.7** Verify the production gate: `pnpm --filter backend build && node backend/dist/main.js --smoke-run` exits 0; the smoke run instantiates the resolved adapter tree (no late-binding crash).
  - Acceptance: Build + smoke green.
  - Spec ref: BRG-6.
  - Files: (verification only).

- [ ] **T3.8** Verify `pnpm --filter backend test` is fully green.
  - Acceptance: Test suite exits 0; no regressions in PR 2's `browser-factory.service.spec.ts`.
  - Spec ref: BFS-S1..S4 + MELI-S1..S5.
  - Files: (verification only).

- [ ] **T3.9** Commit with conventional message, push, and open PR titled `feat(pipeline): MercadoLibre real scraper via Playwright + BrowserFactoryService (mercadolibre-real-scraper)`.
  - Acceptance: PR open, CI green, real-target probe script documented.
  - Spec ref: MELI-1 .. MELI-8.
  - Files: PR + commits only.

---

## PR 4 — AliExpress Real Scraper

**Goal:** Native `AliExpressAdapter` targets `aliexpress.com` via `BrowserFactoryService`, handling i18n/geo, lazy-load scroll, retry/backoff. Retarget from `books.toscrape.com` → `aliexpress.com`.
**Merge dependencies:** PR 1a, PR 1b, PR 2.
**Estimated net lines:** ~+440 (from `design.md` §6). At the 400-line cap; can land in parallel with PR 3 only if isolated worktrees are approved, otherwise sequenced after PR 3.

### Tasks

- [ ] **T4.1** Replace the stub at `backend/src/modules/pipeline/scraping/aliexpress.ts` with the full implementation: navigation against `aliexpress.com` (or its `es.`/`www.` variant), initial locale/region redirect detection + re-navigation, browser from `BrowserFactoryService.launch()`, lazy-load via incremental `window.scrollTo` until no new cards appear twice OR `MAX_SCROLLS` is reached, abort routes for `image|stylesheet|font` via `route.abort()`, retry on transient failures (network reset, 403, captcha marker) with exponential backoff up to `MAX_RETRIES` (default 3), `> 0` items gate, raw payload persisted to `${PIPELINE_RAW_DIR}/ali/<timestamp>.json`, EtlRun row via Prisma, NestJS `Logger`. CLI affordance via `if (require.main === module)`.
  - Acceptance: No `chromium.launch` direct call; URL host is `aliexpress.com` (or its `es.`/`www.` variant); retry budget respected; raw JSON written under `PIPELINE_RAW_DIR/ali/`; `final 'failed'` with `"ali: 0 items extracted"` on zero-item runs.
  - Spec ref: ALI-1, ALI-2, ALI-3, ALI-4, ALI-5, ALI-6, ALI-7, ALI-8.
  - Files: `backend/src/modules/pipeline/scraping/aliexpress.ts`.

- [ ] **T4.2** Update `backend/src/modules/pipeline/adapters/data-sources/ali.adapter.ts` to delegate to the new `scrapeAliExpress` and surface the items + EtlRun result up the adapter chain.
  - Acceptance: Adapter compiles; no bridge references; metrics flow through the same `ScraperMetrics` contract as PR 3.
  - Spec ref: ALI-2, ALI-8.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/ali.adapter.ts`.

- [ ] **T4.3** Add unit tests in `backend/src/modules/pipeline/scraping/__tests__/aliexpress.spec.ts` covering ALI-S1 (URL host is `aliexpress.com`; grep over the adapter file returns zero `books.toscrape.com` / `quotes.toscrape.com`), ALI-S2 (browser comes from `BrowserFactoryService.launch()`, no direct `playwright.chromium.launch`), ALI-S3 (first attempt 403 → sleep 1s → retry → sleep 2s → ... up to `MAX_RETRIES`, then `failed` with attempt count), ALI-S4 (`count > 0` is `success`; `count === 0` is `failed` with `"ali: 0 items extracted"`), ALI-S5 (lazy-load scroll reaches `MAX_SCROLLS`, proceeds against the cards loaded so far, never blocks forever).
  - Acceptance: All five scenarios described; `pnpm --filter backend test aliexpress` green; `BrowserFactoryService` is mocked.
  - Spec ref: ALI-S1, ALI-S2, ALI-S3, ALI-S4, ALI-S5.
  - Files: `backend/src/modules/pipeline/scraping/__tests__/aliexpress.spec.ts`.

- [ ] **T4.4** Add an integration probe script `backend/scripts/probe-ali.ts` analogous to PR 3's MELI probe, asserting `> 0` items on a controlled fixture or against the real target with a probe token.
  - Acceptance: `pnpm --filter backend exec ts-node scripts/probe-ali.ts --fixture` exits 0 and prints the item count.
  - Spec ref: ALI-7.
  - Files: `backend/scripts/probe-ali.ts`.

- [ ] **T4.5** Verify build + smoke + test are all green (`pnpm --filter backend build && node backend/dist/main.js --smoke-run && pnpm --filter backend test`).
  - Acceptance: All three commands exit 0.
  - Spec ref: BRG-6.
  - Files: (verification only).

- [ ] **T4.6** Commit with conventional message, push, and open PR titled `feat(pipeline): AliExpress real scraper via Playwright + BrowserFactoryService (aliexpress-real-scraper)`.
  - Acceptance: PR open, CI green.
  - Spec ref: ALI-1 .. ALI-8.
  - Files: PR + commits only.

---

## PR 5 — Extension-Based Sources (Temu + Shein, unified)

**Goal:** Native `TemuAdapter` + `SheinAdapter` consume `extension_export.json`; zero demo fallback; `BadExtensionExportError` on miss/invalid; no `BrowserFactoryService`, no Playwright in these files.
**Merge dependencies:** PR 1a, PR 1b (independent of PR 2/3/4).
**Estimated net lines:** ~+565 (from `design.md` §6). Over the 400-line cap (~+165) — unified per user decision 2026-07-08. Reviewer batches in two passes: (a) the contracts triplet, (b) the two adapter rewrites + tests.

### Tasks

- [ ] **T5.1** Add `packages/contracts/src/pipeline/source-mechanism.ts` exporting `type SourceMechanism = 'playwright' | 'extension' | 'api' | 'file'` and `SOURCE_MECHANISM_MAP` with the 7 sources (MELI/Ali = `playwright`, Temu/Shein = `extension`, api_rates = `api`, csv/encuesta = `file`).
  - Acceptance: File compiles; `rg "extension" packages/contracts/src/pipeline/source-mechanism.ts` shows the Temu/Shein mappings; exported from the index.
  - Spec ref: EXT-7.
  - Files: `packages/contracts/src/pipeline/source-mechanism.ts`, `packages/contracts/src/pipeline/index.ts`.

- [ ] **T5.2** Add `packages/contracts/src/pipeline/extension-export.ts` exporting `ExtensionExportProduct` (`productId, title, price, currency, category, url`) and `ExtensionExport` (`source: 'temu' | 'shein'`, `capturedAt: string` ISO-8601, `products: ExtensionExportProduct[]`).
  - Acceptance: File compiles, shapes match the design.
  - Spec ref: EXT-3, EXT-6.
  - Files: `packages/contracts/src/pipeline/extension-export.ts`, `packages/contracts/src/pipeline/index.ts`.

- [ ] **T5.3** Add `packages/contracts/src/pipeline/bad-extension-export.error.ts` exporting `class BadExtensionExportError extends Error` with a `reason: 'missing' | 'schema' | 'parse'` discriminator and a descriptive `detail` string.
  - Acceptance: File compiles; error message format matches `design.md` §5.
  - Spec ref: EXT-2, EXT-3.
  - Files: `packages/contracts/src/pipeline/bad-extension-export.error.ts`, `packages/contracts/src/pipeline/index.ts`.

- [ ] **T5.4** Re-export all three contracts from `packages/contracts/src/pipeline/index.ts`.
  - Acceptance: `rg "export \\* from '(source-mechanism|extension-export|bad-extension-export)" packages/contracts/src/pipeline/index.ts` returns the three lines.
  - Spec ref: EXT-1, EXT-7.
  - Files: `packages/contracts/src/pipeline/index.ts`.

- [ ] **T5.5** Replace the stub at `backend/src/modules/pipeline/scraping/temu.ts` with the full implementation: read `EXTENSION_EXPORT_PATH` from `ConfigService`, `fs.readFile` + `JSON.parse`, zod-validated schema (`source='temu'`, `capturedAt` ISO, `products[]` with required fields), throw `BadExtensionExportError('missing' | 'schema', detail)` on miss/invalid (no retry, no demo fallback, no Playwright), persist raw payload as-is to `${PIPELINE_RAW_DIR}/temu/<capturedAt>.json`, emit `> 0` items gate as `success`/`failed`, create Prisma EtlRun row, NestJS `Logger`, CLI affordance via `if (require.main === module)`.
  - Acceptance: Adapter file compiles; `rg "BrowserFactoryService|playwright|playwright-extra|puppeteer-extra-plugin-stealth" backend/src/modules/pipeline/scraping/temu.ts` returns zero hits; the adapter throws the documented errors on the listed conditions.
  - Spec ref: EXT-1, EXT-2, EXT-3, EXT-4, EXT-5, EXT-6, EXT-8.
  - Files: `backend/src/modules/pipeline/scraping/temu.ts`.

- [ ] **T5.6** Replace the stub at `backend/src/modules/pipeline/scraping/shein.ts` with the symmetric full implementation (mirrors T5.5 with `source='shein'` and `PIPELINE_RAW_DIR/shein/`).
  - Acceptance: Same constraints as T5.5 with `shein` substituted.
  - Spec ref: EXT-1, EXT-2, EXT-3, EXT-4, EXT-5, EXT-6, EXT-8.
  - Files: `backend/src/modules/pipeline/scraping/shein.ts`.

- [ ] **T5.7** Update `backend/src/modules/pipeline/adapters/data-sources/temu.adapter.ts` and `.../shein.adapter.ts` to wire the new types (`ExtensionExport`, `BadExtensionExportError`) and surface adapter-level errors into the EtlRun row.
  - Acceptance: Both adapters compile, contain zero `BrowserFactoryService` references.
  - Spec ref: EXT-1, EXT-2, EXT-3.
  - Files: `backend/src/modules/pipeline/adapters/data-sources/temu.adapter.ts`, `backend/src/modules/pipeline/adapters/data-sources/shein.adapter.ts`.

- [ ] **T5.8** Update `backend/src/modules/pipeline/scraping/source-meta.ts` to keep the `temu` and `shein` entries with `mechanism: 'extension'` (the stub map from PR 1b already sets this; this task verifies and tightens the file).
  - Acceptance: `cat backend/src/modules/pipeline/scraping/source-meta.ts | rg "'extension'"` lists both.
  - Spec ref: EXT-7.
  - Files: `backend/src/modules/pipeline/scraping/source-meta.ts`.

- [ ] **T5.9** Add unit tests in `backend/src/modules/pipeline/scraping/__tests__/temu.spec.ts` and `.../shein.spec.ts` covering the EXT scenarios: valid export → raw persisted + EtlRun `success`; missing file → `BadExtensionExportError('missing: <path>')` + EtlRun `failed`; malformed JSON → `BadExtensionExportError('schema: <parse error>')`; schema mismatch (missing `products` array) → error with field name; grep guardrail that the adapter files contain no `quotes.toscrape.com` / `books.toscrape.com` (ran as part of the spec under PR 1a's CI step).
  - Acceptance: All scenarios run as `it(...)`; `pnpm --filter backend test temu && pnpm --filter backend test shein` is green.
  - Spec ref: EXT-1, EXT-2, EXT-3, EXT-6, EXT-8.
  - Files: `backend/src/modules/pipeline/scraping/__tests__/temu.spec.ts`, `backend/src/modules/pipeline/scraping/__tests__/shein.spec.ts`.

- [ ] **T5.10** Verify the CI grep guardrail is still green and additionally tighten `design.md` §9 rule 3 to also cover `temu.ts` + `shein.ts` for `BrowserFactoryService` (rule 3 already does — re-run a local rg to confirm).
  - Acceptance: `rg "BrowserFactoryService" backend/src/modules/pipeline/scraping/temu.ts backend/src/modules/pipeline/scraping/shein.ts` returns zero hits.
  - Spec ref: BFS-5, EXT-4, EXT-5.
  - Files: (verification only).

- [ ] **T5.11** Verify `pnpm --filter backend build && node backend/dist/main.js --smoke-run && pnpm --filter backend test` is fully green.
  - Acceptance: All three commands exit 0.
  - Spec ref: BRG-6.
  - Files: (verification only).

- [ ] **T5.12** Commit with conventional message, push, and open PR titled `feat(pipeline): Temu + Shein native extension-export consumers, zero demo fallback (extension-based-sources)`.
  - Acceptance: PR open, CI green (grep + build + tests).
  - Spec ref: EXT-1 .. EXT-8.
  - Files: PR + commits only.

---

## PR 6 — ETL Staging, Quality, and DW Load (unified)

**Goal:** Native `StagingProcessorService` + `QualityService` (7 checks via NestJS `Logger`) + `DwLoaderService` under `backend/src/modules/pipeline/etl/`, wired through existing `STAGING_PROCESSOR` and `DW_LOADER` tokens. Delete `legacy/pipeline/scripts/{staging,quality,dw}/`. Preserve the 4-state EtlRun.
**Merge dependencies:** PR 1a, PR 1b (only — staging reads the raw JSON that PR 1b creates).
**Estimated net lines:** ~+890 (from `design.md` §6). Far over the 400-line cap (~+490) — unified per user decision 2026-07-08. Reviewer batches in three passes: (a) the 7 quality checks, (b) `quality.service.ts` + `staging-processor.service.ts` orchestration, (c) `dw-loader.service.ts` + adapter wiring.

### Tasks

- [ ] **T6.1** Create `backend/src/modules/pipeline/etl/etl.constants.ts` re-exporting `EtlRunState`, `ETL_RUN_STATES`, `SourceMechanism`, `SOURCE_MECHANISM_MAP` from `@web-scraping/contracts/pipeline` and adding any local constants needed for the 4-state mapping.
  - Acceptance: File compiles; the four enum values (`queued`, `running`, `success`, `failed`) are referenced symbolically, never as free strings.
  - Spec ref: ETL-5.
  - Files: `backend/src/modules/pipeline/etl/etl.constants.ts`.

- [ ] **T6.2** Create the 7 quality check files under `backend/src/modules/pipeline/etl/quality/checks/`:
  - `required-fields.check.ts` (Check 1: every staging row has non-empty `title`, `url`, `source`).
  - `price-positive.check.ts` (Check 2: `price > 0`).
  - `currency-known.check.ts` (Check 3: `currency` ∈ known set).
  - `url-well-formed.check.ts` (Check 4: `url` parses as a URL).
  - `category-nonempty.check.ts` (Check 5: `category` non-empty).
  - `duplicate-product-id.check.ts` (Check 6: no duplicate `product_id` in the batch).
  - `staging-row-count.check.ts` (Check 7: at least one row).
  - Acceptance: Each file exports a function with the same shape `(rows) => { passed: boolean; failures: string[] }`; `nest build` resolves them; functions are pure (no IO).
  - Spec ref: ETL-3.
  - Files: `backend/src/modules/pipeline/etl/quality/checks/*.check.ts` (7 files).

- [ ] **T6.3** Create `backend/src/modules/pipeline/etl/quality.service.ts` as a NestJS `@Injectable()` that aggregates the 7 checks, builds a `QualityReport` listing each check's name + status + failures, emits per-check log lines through the NestJS `Logger` (not `console`), and **fails-fast**: if any check is `failed`, the service throws or returns a `QualityReport` whose overall state is `failed`.
  - Acceptance: File compiles; all 7 log lines go through `this.logger`; fail-fast verified by a unit test where 1/7 checks fails and the service returns `QualityReport.failed`.
  - Spec ref: ETL-3, ETL-4.
  - Files: `backend/src/modules/pipeline/etl/quality.service.ts`.

- [ ] **T6.4** Create `backend/src/modules/pipeline/etl/staging-processor.service.ts` implementing `IStagingProcessor` from `backend/src/modules/pipeline/interfaces/`: reads raw JSON under `${PIPELINE_RAW_DIR}/<source>/<runId>.json`, transforms each item into a staging row using the ported `stg_*` helpers, writes staging rows under `${PIPELINE_STAGING_DIR}/<source>/<runId>.json`, returns `StagingResult`. Uses Prisma to write the staging rows if the schema requires it (per ETL-2 helper patterns); CLI affordance via `if (require.main === module)`.
  - Acceptance: File compiles, satisfies `IStagingProcessor`, reads from `PIPELINE_RAW_DIR` (not `process.cwd()`), returns a `StagingResult` with the row count equal to `raw.products.length` (modulo dropped rows).
  - Spec ref: ETL-1.
  - Files: `backend/src/modules/pipeline/etl/staging-processor.service.ts`.

- [ ] **T6.5** Create `backend/src/modules/pipeline/etl/dw-loader.service.ts` implementing `IDwLoader`: upserts staging rows into `dw.dim_fuente` (using `nombre_fuente` values that exactly match the `PipelineSource` enum members) and `dw.hecho_producto` via Prisma, returns `LoadResult` with `estado: 'completado'` on success. Throws an error whose cause is preserved when the upsert fails; the caller maps this to `EtlRun.status = 'failed'`.
  - Acceptance: File compiles, satisfies `IDwLoader`, all upserts go through Prisma client; `LoadResult.estado` is one of `completado` / `fallido`.
  - Spec ref: ETL-2.
  - Files: `backend/src/modules/pipeline/etl/dw-loader.service.ts`.

- [ ] **T6.6** Rewrite `backend/src/modules/pipeline/adapters/staging-processor.adapter.ts` to delegate to the new `StagingProcessorService` via the `STAGING_PROCESSOR` DI token; drop any bridge reference.
  - Acceptance: Adapter compiles, no `bridge` reference, single delegation call.
  - Spec ref: ETL-1, BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/staging-processor.adapter.ts`.

- [ ] **T6.7** Rewrite `backend/src/modules/pipeline/adapters/dw-loader.adapter.ts` to delegate to the new `DwLoaderService` via the `DW_LOADER` DI token; drop any bridge reference.
  - Acceptance: As T6.6 with the DW adapter.
  - Spec ref: ETL-2, BRG-3.
  - Files: `backend/src/modules/pipeline/adapters/dw-loader.adapter.ts`.

- [ ] **T6.8** Register `StagingProcessorService`, `QualityService`, and `DwLoaderService` in `backend/src/modules/pipeline/pipeline.module.ts` `providers`; rebind the `STAGING_PROCESSOR` and `DW_LOADER` tokens to the new service class implementations (token shape is unchanged).
  - Acceptance: `rg "StagingProcessorService|QualityService|DwLoaderService" backend/src/modules/pipeline/pipeline.module.ts` shows the three provider entries plus the token rebindings.
  - Spec ref: ETL-1, ETL-2, ETL-3.
  - Files: `backend/src/modules/pipeline/pipeline.module.ts`.

- [ ] **T6.9** Update `backend/src/modules/pipeline/etl-scheduler.service.ts` so the cron triggers the native adapters end-to-end (`runXxxScrape` → `STAGING_PROCESSOR` → `QualityService` → `DW_LOADER` → `EtlRun` row in the correct 4-state) without behavior changes to the schedule itself.
  - Acceptance: Cron trigger still calls the same cron expression, but the resolved adapter/services are the native ones; `--smoke-run` exits 0 and confirms DI resolution.
  - Spec ref: ETL-1, ETL-4, ETL-5.
  - Files: `backend/src/modules/pipeline/etl-scheduler.service.ts`.

- [ ] **T6.10** Delete `legacy/pipeline/scripts/{staging,quality,dw}/` with `git rm -r` (scraping was deleted in PR 1b; this task removes the remaining three). Verify nothing else inside `legacy/` was touched.
  - Acceptance: `git log --diff-filter=D --stat -- legacy/` shows only the staging/quality/dw subfolders deleted; `legacy/` directory still exists.
  - Spec ref: ETL-7, BRG-5.
  - Files: `legacy/pipeline/scripts/staging/**`, `legacy/pipeline/scripts/quality/**`, `legacy/pipeline/scripts/dw/**` (DELETED).

- [ ] **T6.11** Add unit tests in `backend/src/modules/pipeline/etl/__tests__/` for:
  - Each of the 7 quality checks (one spec file per check).
  - `quality.service.spec.ts` — `run()` aggregates 7 checks, fails-fast on 1 failure, emits all log lines via the NestJS `Logger`.
  - `staging-processor.service.spec.ts` — staging reads raw JSON from `PIPELINE_RAW_DIR`, returns `StagingResult` with the right row count.
  - `dw-loader.service.spec.ts` — `nombre_fuente` ↔ `PipelineSource` alignment (every `PipelineSource` member has a matching `dim_fuente` row), 4-state EtlRun transitions, fail-fast when `QualityService.run()` returns `failed`.
  - Acceptance: `pnpm --filter backend test etl` is green; the `dw-loader.service.spec.ts` test covers ETL-6 explicitly.
  - Spec ref: ETL-1, ETL-2, ETL-3, ETL-4, ETL-5, ETL-6.
  - Files: `backend/src/modules/pipeline/etl/__tests__/quality/checks/*.check.spec.ts` (7), `backend/src/modules/pipeline/etl/__tests__/quality.service.spec.ts`, `backend/src/modules/pipeline/etl/__tests__/staging-processor.service.spec.ts`, `backend/src/modules/pipeline/etl/__tests__/dw-loader.service.spec.ts`.

- [ ] **T6.12** Verify the CI grep guardrail is still green: re-run `rg "quotes.toscrape.com|books.toscrape.com|ts-node|eval\('require'\)" backend/src/ legacy/` and confirm zero hits.
  - Acceptance: Zero hits; no remaining `legacy/pipeline/scripts/{scraping,staging,quality,dw}/` paths.
  - Spec ref: BRG-7, EXT-8.
  - Files: (verification only).

- [ ] **T6.13** Verify the full local pipeline gate: `pnpm --filter backend build && node backend/dist/main.js --smoke-run && pnpm --filter backend test` is fully green.
  - Acceptance: All three commands exit 0.
  - Spec ref: BRG-6.
  - Files: (verification only).

- [ ] **T6.14** Commit with conventional message, push, and open PR titled `feat(pipeline): native staging / quality (7 checks) / DW loader as NestJS services, legacy ETL scripts removed (etl-staging-dw-native)`.
  - Acceptance: PR open, CI green (grep + build + tests), reviewer batching notes attached to the PR description (3 review passes per `design.md` §6).
  - Spec ref: ETL-1 .. ETL-7.
  - Files: PR + commits only.
