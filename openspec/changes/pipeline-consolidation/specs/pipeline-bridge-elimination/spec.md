# Spec — Pipeline Bridge Elimination

## 1. Objective

`backend/src/modules/pipeline/pipeline-scripts-bridge.ts` MUST be deleted. The `eval('require')` + `ts-node` runtime mechanism that loads legacy `.ts` scripts at runtime MUST be replaced by static `import` statements pointing at native, statically-compiled TypeScript modules under `backend/src/modules/pipeline/scraping/`. After this change, the production build MUST run reproducibly via `pnpm --filter backend build && node backend/dist/main.js`, with no `.ts` file ever loaded at runtime, and a CI grep guardrail MUST keep `quotes.toscrape.com` and `books.toscrape.com` out of the source tree.

## 2. Scope

### In

- Deleting `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` and every `eval('require')`, `ts-node`, and `require.resolve(...pipeline/scripts)` reference inside the backend tree.
- Creating a native module under `backend/src/modules/pipeline/scraping/` for each of the 7 sources, named exactly: `mercadolibre.ts`, `aliexpress.ts`, `temu.ts`, `shein.ts`, `exchange-rates.ts`, `csv-loader.ts`, `encuesta-loader.ts`.
- Updating each of the 7 thin adapters (`meli`, `ali`, `temu`, `shein`, `api-rates`, `csv`, `encuesta`) under `backend/src/modules/pipeline/adapters/data-sources/` to import its native module via static ES `import`.
- Deleting `legacy/pipeline/scripts/{scraping,staging,quality,dw}/` while preserving the rest of `legacy/` as archived evidence.
- Restoring the `@web-scraping/contracts` workspace package locally so the backend import `from '@web-scraping/contracts/pipeline'` resolves without path aliases.
- Adding CI grep guardrails that block any new reference to `quotes.toscrape.com` or `books.toscrape.com` inside `backend/src/` or `legacy/`.

### Out

- Implementation details of any individual native scraper (covered by `browser-factory-stealth`, `mercadolibre-real-scraper`, `aliexpress-real-scraper`, `extension-based-sources`).
- ETL staging / quality / DW wiring (covered by `etl-staging-dw-native`).
- WebSocket or live-log plumbing.
- Residential proxy vendor selection.
- Frontend changes of any kind.

## 3. Functional Requirements

- **BRG-1** The file `backend/src/modules/pipeline/pipeline-scripts-bridge.ts` MUST be deleted from the repository with no replacement file preserving the `eval('require')` semantics.
- **BRG-2** The backend tree MUST NOT contain any reference to `ts-node`, `eval('require')`, or `require.resolve(.*pipeline/scripts)` after the migration. Any new occurrence MUST be treated as a CI failure.
- **BRG-3** Each of the 7 adapters — `meli`, `ali`, `temu`, `shein`, `api-rates`, `csv`, `encuesta` — MUST import its scraping implementation via a static ES `import` statement. Adapters MUST NOT use `require()` or any dynamic import path against the native scraping modules.
- **BRG-4** The directory `backend/src/modules/pipeline/scraping/` MUST contain a native module per source, named exactly: `mercadolibre.ts`, `aliexpress.ts`, `temu.ts`, `shein.ts`, `exchange-rates.ts`, `csv-loader.ts`, `encuesta-loader.ts`.
- **BRG-5** The directory `legacy/pipeline/scripts/` MUST be removed. The top-level `legacy/` directory MUST remain as archived evidence and MUST NOT be deleted in this change.
- **BRG-6** The backend MUST be runnable as `pnpm --filter backend build && node backend/dist/main.js`, completing a full pipeline run with zero TypeScript compile errors and without invoking `ts-node` or `eval('require')` at any point in the process tree.
- **BRG-7** A grep across `backend/src/` and `legacy/` MUST return zero hits for `quotes.toscrape.com` or `books.toscrape.com`. A CI guardrail MUST enforce this rule and MUST block a merge on any future regression.
- **BRG-8** The `@web-scraping/contracts` workspace package MUST be restored locally to a state that resolves the import `from '@web-scraping/contracts/pipeline'` without path aliases.
- **BRG-9** No legacy-fallback test fixture that simulates a broken `require.resolve` against `backend/pipeline/scripts/` MAY be shipped. Tests MUST assert against the native module surface — not against a synthetic re-creation of the bridge failure mode.

## 4. Non-Functional Requirements

- Build determinism: `pnpm --filter backend build` MUST be deterministic and reproducible on a clean checkout.
- CI guardrail: a `rg`-based guard MUST run on CI and MUST block any PR that reintroduces `quotes.toscrape.com`, `books.toscrape.com`, `ts-node`, or `eval('require')` inside `backend/src/` or `legacy/`.
- Atomic delete: `BRG-1` MUST land in a single commit so a half-deleted bridge state is not observable in git history.
- Adapter compile-time safety: each adapter's static `import` MUST cause a TypeScript compile error if the native module is missing, preventing silent reverts to dynamic loading.
- Restored `@web-scraping/contracts` MUST keep its existing public types (`PipelineSource`, `ScrapeResult`, `SourceConfig`, `IStagingProcessor`, `IDwLoader`) — no shape changes in this change.

## 5. Scenarios

### 5.1 BRG-S1 — Grep guardrail returns zero hits for demo domains

**Given** the bridge has been deleted and all 7 native scraping modules have landed  
**When** `rg "quotes.toscrape.com|books.toscrape.com" backend/src/ legacy/` is executed  
**Then** the command MUST return zero matching lines

### 5.2 BRG-S2 — Production build runs end-to-end without ts-node or eval('require')

**Given** the bridge has been deleted, `node_modules` is fresh, and `backend/.env` is configured  
**When** `pnpm --filter backend build` is executed and then `node backend/dist/main.js` is invoked  
**Then** `pnpm --filter backend build` MUST exit with status zero and report zero TypeScript errors  
**And** `node backend/dist/main.js` MUST execute a full end-to-end pipeline run  
**And** no `ts-node` and no `eval('require')` invocation MUST appear anywhere in the process tree

### 5.3 BRG-S3 — Each adapter imports its module statically

**Given** the 7 native scraping modules exist under `backend/src/modules/pipeline/scraping/`  
**When** the source of each adapter (`meli`, `ali`, `temu`, `shein`, `api-rates`, `csv`, `encuesta`) is inspected  
**Then** every adapter MUST contain a static ES `import` statement for its corresponding native module  
**And** no adapter MUST use `require()` or a dynamic import path against its scraping module

### 5.4 BRG-S4 — Native module layout matches the agreed filenames

**Given** the migration is complete  
**When** the directory `backend/src/modules/pipeline/scraping/` is listed  
**Then** the files `mercadolibre.ts`, `aliexpress.ts`, `temu.ts`, `shein.ts`, `exchange-rates.ts`, `csv-loader.ts`, and `encuesta-loader.ts` MUST be present

### 5.5 BRG-S5 — No legacy-fallback bridge re-creation

**Given** the bridge path `pipeline-scripts-bridge.ts` is intentionally gone  
**When** the test suite is inspected for any fixture that simulates a broken `require.resolve` against `backend/pipeline/scripts/`  
**Then** no such fixture MUST exist  
**And** tests that previously lived under the bridge MUST be rewritten against the native modules
