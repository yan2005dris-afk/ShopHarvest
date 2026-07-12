# Proposal: Operational Database ETL

## Intent
Transition the ETL pipeline from file-based reading to extracting directly from the `RawCapture` operational database table, avoiding data drift and supporting reliability with retry limits.

## Scope
### In Scope
- Migration to add `status` (UNPROCESSED/PROCESSED/FAILED) and `attempts` columns to `RawCapture` table.
- Refactor `StagingProcessorService` to query `RawCapture` (where `status` in [UNPROCESSED, FAILED] and `attempts < 3`).
- Refactor `DwLoaderService` to mark loaded records as `PROCESSED` in operational DB.
- Increment `attempts` and update `status` to `FAILED` for records failing staging.
- Retain file fallbacks for surveys and exchange rates.

### Out of Scope
- Migrating surveys (`encuesta`) or exchange rates to DB.
- Two-phase transaction safety across databases.

## Capabilities
### New Capabilities
- None

### Modified Capabilities
- `raw-capture-ingestion`: Add `status` and `attempts` columns to `RawCapture` model, set `UNPROCESSED` on ingestion.

## Approach
Query pending operational captures (`attempts < 3`), enrich staging records, and write to staging. On successful DW load, perform best-effort batch update of loaded IDs to `PROCESSED`. On transform failure, increment `attempts` and mark `FAILED`.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `backend/prisma/operational/schema.prisma` | Modified | Add `status` and `attempts` fields and index. |
| `backend/src/modules/pipeline/etl/staging-processor.service.ts` | Modified | Query DB instead of files for products. |
| `backend/src/modules/pipeline/etl/dw-loader.service.ts` | Modified | Inject operational DB client to update status. |
| `backend/src/modules/pipeline/etl/__tests__/staging-processor.service.spec.ts` | Modified | Mock DB queries/writes. |

## Risks
| Risk | Likelihood | Mitigation |
|------|--------|-------------|
| Poison pill blocks pipeline | Med | Limit to 3 retries, flag `FAILED`, and bypass. |
| Data duplication on retry | Low | Analytics DB has upsert constraints. |

## Rollback Plan
Revert code commits, run Prisma migration rollback to revert schema changes.

## Dependencies
- Operational DB Prisma schema migration.

## Success Criteria
- [ ] ETL pipeline extracts products from DB.
- [ ] Processed rows are marked `PROCESSED`.
- [ ] Poison pill records are bypassed after 3 failures.
- [ ] Surveys and rates retain file fallback functionality.
