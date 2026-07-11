# Spec — extension-based-sources

## 1. Objective

Provide native `TemuAdapter` and `SheinAdapter` that consume `extension_export.json` produced by the user's Chrome extension. There is **zero demo fallback**: a missing or malformed export raises an explicit `BadExtensionExportError` and the corresponding `EtlRun` is marked `failed` — the adapters never redirect to a demo site.

## 2. Scope

### In

- Native adapters under `backend/src/modules/pipeline/scraping/temu.ts` and `shein.ts`.
- Reading `extension_export.json` from a configurable path (`EXTENSION_EXPORT_PATH` env var, default `backend/pipeline/extension/extension_export.json`).
- Strict schema validation (`source`, `capturedAt`, `products[]` with `title`, `price`, `currency`, `category`, `url`).
- `source-meta.ts` entry with `mechanism: "extension"` for both sources.
- CLI affordance via `if (require.main === module)`.
- Raw payload persisted as-is (no transformation) to `PIPELINE_RAW_DIR`.

### Out

- Playwright, stealth, proxy, or `BrowserFactoryService` (these are anti-patterns for extension-based sources).
- Any redirect to `quotes.toscrape.com`, `books.toscrape.com`, or any other demo target.
- Changes to the Chrome extension itself or its export schema (owned by the extension team).

## 3. Functional Requirements

- **EXT-1** The `EXTENSION_EXPORT_PATH` MUST be read from `ConfigService` (env `EXTENSION_EXPORT_PATH`) and the file MUST be read with `fs.readFile` + `JSON.parse`. The path MUST NOT be hardcoded with `process.cwd()`.
- **EXT-2** If the file does not exist or is unreadable, the adapter MUST throw `BadExtensionExportError("missing")` and the EtlRun MUST be recorded as `failed` with that message — no retry, no fallback.
- **EXT-3** If the JSON is malformed (parse error) or does not match the required schema (`source`, `capturedAt`, `products[]` with required fields), the adapter MUST throw `BadExtensionExportError("schema")` with the underlying parse/validation error attached. The EtlRun MUST be `failed`.
- **EXT-4** The adapter MUST NOT import `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, or `BrowserFactoryService`. A grep over `temu.ts` and `shein.ts` for those symbols MUST return zero hits.
- **EXT-5** The adapter MUST NOT import or reference `BrowserFactoryService` and MUST NOT perform any HTTP fetch to `*.temu.com`, `*.shein.com`, or any demo target.
- **EXT-6** The adapter MUST persist the raw `extension_export.json` payload as-is to `PIPELINE_RAW_DIR/<source>/<capturedAt>.json` (no mutation) and MUST use the `> 0` items gate against `products.length` to decide `success` vs `failed`.
- **EXT-7** `source-meta.ts` MUST list both `temu` and `shein` with `mechanism: "extension"` so the scheduler and UI can render a distinct health state for extension-based sources.
- **EXT-8** The `quotes.toscrape.com` and `books.toscrape.com` strings MUST NOT appear in `temu.ts`, `shein.ts`, or any adapter unit test for these sources (CI grep guardrail).

## 4. Non-Functional Requirements

- All log lines MUST go through NestJS `Logger`.
- Schema validation SHOULD be implemented with `zod` (or an equivalent strict validator) and pinned in `@web-scraping/contracts` so the extension team can sync against it.
- Each adapter MUST be runnable as a CLI for single-source re-runs (`if (require.main === module)`).

## 5. Scenarios

### 5.1 Happy path — real export consumed end-to-end

**Given** a valid `extension_export.json` exists at `EXTENSION_EXPORT_PATH` with `products.length > 0`
**When** the Temu (or Shein) adapter runs
**Then** it MUST persist the raw payload as-is to `PIPELINE_RAW_DIR`, create a Prisma `EtlRun` row with status `success`, and pass `products.length` to the staging processor.

### 5.2 Missing export file

**Given** `EXTENSION_EXPORT_PATH` points to a path that does not exist
**When** the adapter runs
**Then** it MUST throw `BadExtensionExportError("missing: <path>")` and the EtlRun MUST be `failed` with that error. The adapter MUST NOT attempt to scrape a demo URL.

### 5.3 Malformed JSON

**Given** the file exists but contains invalid JSON
**When** `JSON.parse` fails
**Then** the adapter MUST throw `BadExtensionExportError("schema: <parse error>")` and the EtlRun MUST be `failed` with the parse error message attached.

### 5.4 Schema mismatch (missing products array)

**Given** the file is valid JSON but `products` is absent or not an array
**When** the schema validator runs
**Then** the adapter MUST throw `BadExtensionExportError("schema: <field>")` listing the offending field and the EtlRun MUST be `failed`.

### 5.5 Grep guardrail — no demo fallback in source

**Given** a CI step runs `rg "quotes\.toscrape\.com|books\.toscrape\.com" backend/src/modules/pipeline/scraping/temu.ts backend/src/modules/pipeline/scraping/shein.ts`
**When** the step executes
**Then** the command MUST exit with code 1 (no matches) and the build MUST fail if any match is found. The same guardrail MUST also run over the adapter's unit-test file.
