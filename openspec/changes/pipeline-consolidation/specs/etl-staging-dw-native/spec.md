# Spec — etl-staging-dw-native (MODIFIED)

## 1. Objective

Migrate the staging processor, quality service (7 checks), and DW loader from `legacy/pipeline/scripts/{staging,quality,dw}/` into NestJS-native services under `backend/src/modules/pipeline/etl/`, wired through the existing `IStagingProcessor` and `IDwLoader` ports. The migration preserves the `public.EtlRun` 4-state enum and the `dw.dim_fuente.nombre_fuente` ↔ `PipelineSource` alignment without schema changes.

## 2. Scope

### In

- `backend/src/modules/pipeline/etl/staging-processor.service.ts` implementing `IStagingProcessor`.
- `backend/src/modules/pipeline/etl/quality.service.ts` implementing the 7 quality checks using NestJS `Logger`.
- `backend/src/modules/pipeline/etl/dw-loader.service.ts` implementing `IDwLoader` using Prisma.
- `backend/src/modules/pipeline/etl/quality/checks/*.check.ts` (or equivalent) for each of the 7 checks.
- Wiring through DI tokens `STAGING_PROCESSOR` and `DW_LOADER` in `pipeline.module.ts`.
- CLI affordance for single-source staging runs.
- Deletion of `legacy/pipeline/scripts/{staging,quality,dw}/`.

### Out

- Any change to `public.EtlRun` schema (states stay `queued` / `running` / `success` / `failed`).
- Any change to `dw.dim_fuente.nombre_fuente` values or the `PipelineSource` enum.
- DB migrations of any kind.
- Changes to `legacy/` outside of `legacy/pipeline/scripts/`.

## 3. Functional Requirements

- **ETL-1** `StagingProcessorService` MUST implement `IStagingProcessor` from `backend/src/modules/pipeline/interfaces/` and MUST consume raw JSON from `PIPELINE_RAW_DIR`, transforming it into staging rows using the existing `stg_*` helpers (logic ported, not duplicated).
- **ETL-2** `DwLoaderService` MUST implement `IDwLoader` using Prisma and MUST upsert into `dw.dim_fuente` / `dw.hecho_producto` (or the canonical DW tables in the Prisma schema) with `nombre_fuente` values that exactly match the `PipelineSource` enum members (`meli`, `ali`, `temu`, `shein`, `api_rates`, `csv`, `encuesta`).
- **ETL-3** `QualityService` MUST run exactly 7 quality checks per staging batch (the same 7 implemented in `legacy/pipeline/scripts/quality/quality_checks.ts`) and MUST use NestJS `Logger` (`@nestjs/common` `Logger`) — not `console` — for every log line.
- **ETL-4** `QualityService` MUST fail-fast on any failed check: if any of the 7 checks returns `failed`, the run MUST be marked `failed` in `public.EtlRun` and the DW loader MUST NOT be invoked for that batch.
- **ETL-5** The `public.EtlRun.status` enum MUST remain the 4-valued set `queued` / `running` / `success` / `failed`. The native services MUST write the same 4 values via Prisma that the legacy scripts wrote; no new state values, no schema migration.
- **ETL-6** `dw.dim_fuente.nombre_fuente` values MUST stay aligned with the `PipelineSource` enum. Any new source added MUST require both an enum update AND a corresponding `dim_fuente` upsert — enforced by a unit test.
- **ETL-7** `legacy/pipeline/scripts/{staging,quality,dw}/` MUST be deleted in this change; `legacy/` directory MUST remain as archive. The deletion MUST be verified by `git status` showing those folders removed and nothing else inside `legacy/` touched.

## 4. Non-Functional Requirements

- All three services MUST be NestJS `@Injectable()` providers registered in `pipeline.module.ts` `providers`.
- The DI tokens `STAGING_PROCESSOR` and `DW_LOADER` MUST stay unchanged; only the bound implementations change.
- Quality check errors MUST be aggregated into a single `QualityReport` so the run failure message lists every failing check, not just the first.
- Each service MUST be runnable as a CLI for single-batch re-runs (`if (require.main === module)`).

## 5. Scenarios

### 5.1 Staging wired through IStagingProcessor

**Given** raw JSON exists at `PIPELINE_RAW_DIR/<source>/<runId>.json`
**When** `pipeline.service.ts` triggers the staging phase
**Then** the `STAGING_PROCESSOR` token MUST resolve to `StagingProcessorService` (not the bridge), the staging row count MUST equal the raw `products.length` (modulo dropped rows), and a `StagingResult` MUST be returned.

### 5.2 Quality fail-fast on any failed check

**Given** a staging batch where 1 of the 7 quality checks returns `failed` (e.g. duplicate `product_id`)
**When** `QualityService.run()` executes
**Then** the service MUST return a `QualityReport` listing the failed check name and reason, the `EtlRun` MUST be marked `failed`, and `DwLoaderService.load()` MUST NOT be called for that batch.

### 5.3 DW loader upserts via Prisma

**Given** a quality-passed staging batch for source `temu`
**When** `DwLoaderService.load()` runs
**Then** it MUST upsert a row in `dw.dim_fuente` with `nombre_fuente = 'temu'` (matching the `PipelineSource.temu` enum value), upsert the corresponding `hecho_producto` rows via Prisma, and return `LoadResult.estado = 'completado'`. The same mapping MUST hold for the other 6 sources.

### 5.4 4-state EtlRun preserved, no schema change

**Given** the legacy `EtlRun` table with rows holding `status ∈ {queued, running, success, failed}`
**When** the native services run end-to-end
**Then** every status transition MUST use one of those 4 values, the Prisma client MUST NOT generate a migration that adds/removes enum members, and the schema MUST stay byte-identical to the pre-change state.

### 5.5 Legacy scripts deleted, legacy/ preserved

**Given** the migration is complete
**When** `git status` runs against `legacy/`
**Then** `legacy/pipeline/scripts/{staging,quality,dw}/` MUST be reported as deleted, no other path inside `legacy/` MUST be modified, and `legacy/` directory MUST still exist.
