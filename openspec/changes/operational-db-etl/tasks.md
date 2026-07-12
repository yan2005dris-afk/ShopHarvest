# Tasks: Operational Database ETL

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300-420 lines |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Migration & Ingest Reset) → PR 2 (Staging & DW Loader) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migrate DB and reset status on ingest | PR 1 | `npm run test backend/src/modules/products` | `npx prisma migrate dev --schema=backend/prisma/operational/schema.prisma` | schema.prisma, raw-captures.service.ts, products.service.ts |
| 2 | Refactor pipeline extraction and status marking | PR 2 | `npm run test backend/src/modules/pipeline/etl` | `npm run start:dev` (trigger ETL run) | staging-processor.service.ts, dw-loader.service.ts |

## Phase 1: Database Schema & Ingestion Setup

- [x] 1.1 Add `RawCaptureStatus` enum (`UNPROCESSED`, `PROCESSED`, `FAILED`), fields `status`, `attempts`, and index `@@index([status, attempts])` to `RawCapture` in [schema.prisma](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/prisma/operational/schema.prisma).
- [x] 1.2 Run `npx prisma migrate dev --name add_raw_capture_queue_fields --schema=backend/prisma/operational/schema.prisma` to apply migration.
- [x] 1.3 Update `upsert` in [raw-captures.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/raw-captures/raw-captures.service.ts) to reset `status` to `UNPROCESSED` and `attempts` to `0`.
- [x] 1.4 Update `ingestFromExtension` in [products.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/products/products.service.ts) to reset `status` to `UNPROCESSED` and `attempts` to `0` on `rawCapture.upsert`.

## Phase 2: Pipeline Refactoring

- [ ] 2.1 Refactor `StagingProcessorService` in [staging-processor.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/staging-processor.service.ts) to query `RawCapture` where `status` is pending (`UNPROCESSED`/`FAILED`) and `attempts < 3`.
- [ ] 2.2 Add error handling in `StagingProcessorService` to increment `attempts` and mark status as `FAILED` on transformation error.
- [ ] 2.3 Refactor `DwLoaderService` in [dw-loader.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/dw-loader.service.ts) to collect successfully loaded `(offerId, sourceId)` pairs from staging.
- [ ] 2.4 Add batch status update in `DwLoaderService` to mark loaded captures as `PROCESSED` in the operational database.

## Phase 3: Testing & Verification

- [ ] 3.1 Refactor unit tests in [staging-processor.service.spec.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/__tests__/staging-processor.service.spec.ts) to mock database queries/updates.
- [ ] 3.2 Refactor unit tests in [dw-loader.service.spec.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/__tests__/dw-loader.service.spec.ts) to mock operational database and check status marking.
- [ ] 3.3 Verify full integration run by triggering ETL pipeline end-to-end.
