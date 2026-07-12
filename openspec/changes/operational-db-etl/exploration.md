## Exploration: Redesign the ETL pipeline (Staging + DW Loader) to extract pending data from the operational database (`RawCapture` table)

### Current State
Today, the ETL pipeline operates on flat JSON files written to disk under the `pipeline/raw/<source>` directory. `StagingProcessorService` finds the latest JSON file for each source, normalizes the records, and writes them to `pipeline/staging/all_products.json` and `stg_encuesta.json`. Then, `DwLoaderService` reads these staging files, runs quality checks, and loads them into the Analytical database (DW). 

The extension now ingests raw data directly via `/products/ingest` and writes to the `RawCapture` model in the operational database. However, the ETL pipeline still reads from files, creating drift and bypassing the ingested database records.

### Affected Areas
- `backend/prisma/operational/schema.prisma` — Needs `processed` column and index on `RawCapture` model.
- `backend/src/modules/pipeline/etl/staging-processor.service.ts` — Needs refactoring to query `RawCapture` from `OperationalPrismaService` instead of calling `loadLatestRaw` on files for product sources.
- `backend/src/modules/pipeline/etl/dw-loader.service.ts` — Needs `OperationalPrismaService` injected to mark successfully loaded records as processed in the operational database.
- `backend/src/modules/pipeline/etl/__tests__/staging-processor.service.spec.ts` — Needs mock database queries to replace local filesystem mock writes.

### Approaches
1. **Staging Extraction & Post-DW Load Marking (Recommended)** — `StagingProcessorService` queries `RawCapture` for `processed: false` records, enriches staging rows with `_offerId` and `_sourceId` metadata, and writes them to the staging file. `DwLoaderService` reads them, and upon successfully writing them to the Analytical DB, performs a batch update marking those specific IDs as `processed: true` in the operational DB.
   - Pros: Guarantees that records are only marked processed when successfully stored in the DW. Keeps quality checks (ETL-4) and staging files intact.
   - Cons: Requires injecting `OperationalPrismaService` into `DwLoaderService`.
   - Effort: Medium

2. **Immediate Staging-Time Marking** — `StagingProcessorService` marks records as processed immediately during the staging phase, before they are loaded into the DW.
   - Pros: Simpler, keeps `DwLoaderService` decoupled from the operational DB.
   - Cons: High risk of data loss. If the DW loader fails (e.g., quality gate abort), records are marked as processed but never load into the DW, leading to missing data.
   - Effort: Low

### Recommendation
Adopt **Approach 1 (Staging Extraction & Post-DW Load Marking)**. It guarantees data integrity and referential tracking through the pipeline.

### Risks
- **Survey & Exchange Rates Compatibility**: Survey (`encuesta`) data and exchange rates (`api_rates`) do not belong to `Offer` and cannot reside in the `RawCapture` table. We must maintain file-based loading fallbacks for these types of data in `StagingProcessorService` so we don't break existing tests or features.
- **Unprocessed Accumulation**: If records fail quality checks repeatedly, they will remain unprocessed forever. We should implement logging or alerts for records failing staging transforms or quality gates repeatedly.

### Ready for Proposal
Yes — the proposal can be generated outlining the schema migration, Staging/DW Loader service adjustments, and test modifications.
