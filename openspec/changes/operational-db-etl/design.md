# Design: Operational Database ETL Redesign

## Technical Approach
Transition the ETL pipeline from file-based reading of raw product files to extracting directly from the `RawCapture` operational database table. This eliminates operational data drift and enables retry-limit support for ingestion reliability.

## Architecture Decisions
| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| **Staging Data Retrieval** | Query `RawCapture` table via `OperationalPrismaService` where `status IN [UNPROCESSED, FAILED]` and `attempts < 3`. | File-based ETL for product sources. | Prevents data drift by using database records ingested directly by the extension. |
| **Loader Status Marking** | Bulk update `RawCapture` status to `PROCESSED` in `DwLoaderService` post successful DW load. | Immediate status update during staging. | Prevents data loss: records are only marked `PROCESSED` when successfully loaded into the DW. |
| **Error Handling (Staging)** | Increment `attempts` and set status to `FAILED` for each capture failing transform. | Stop ETL batch on transform failure. | Bypasses poison pill records (max 3 attempts) while ensuring the rest of the batch is processed. |

## Data Flow
```
Operational DB (RawCapture)
      │  (Query UNPROCESSED/FAILED, attempts < 3)
      ▼
StagingProcessorService (Enrich with _offerId, _sourceId) ──► staging/all_products.json
      │ (If transform fails: status -> FAILED, attempts++)
      ▼
DwLoaderService (Quality Checks & Write to DW)
      │
      ▼ (Bulk update status to PROCESSED in Operational DB)
Operational DB (RawCapture)
```

## File Changes
| File | Action | Description |
|---|---|---|
| [schema.prisma](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/prisma/operational/schema.prisma) | Modify | Add `RawCaptureStatus` enum, add `status` and `attempts` fields, and add index `@@index([status, attempts])` to `RawCapture`. |
| [staging-processor.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/staging-processor.service.ts) | Modify | Inject `OperationalPrismaService`. Fetch from `RawCapture` table for product sources; write metadata `_offerId` and `_sourceId` to `all_products.json`. Increment attempts and mark `FAILED` on error. Keep file fallback for surveys and rates. |
| [dw-loader.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/dw-loader.service.ts) | Modify | Inject `OperationalPrismaService`. Bulk update `status` to `PROCESSED` for successfully loaded product rows. |
| [raw-captures.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/raw-captures/raw-captures.service.ts) | Modify | Update `upsert` to reset `status` to `UNPROCESSED` and `attempts` to `0`. |
| [products.service.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/products/products.service.ts) | Modify | Update `ingestFromExtension` transaction to reset `status` to `UNPROCESSED` and `attempts` to `0` on `rawCapture.upsert`. |
| [staging-processor.service.spec.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/__tests__/staging-processor.service.spec.ts) | Modify | Refactor tests to mock operational DB calls (query/update) instead of writing mock filesystem files. |
| [dw-loader.service.spec.ts](file:///home/yan2005dris-afk/Documentos/GitHub/WebScrapingDinamico-Automatico/backend/src/modules/pipeline/etl/__tests__/dw-loader.service.spec.ts) | Modify | Update tests to mock `OperationalPrismaService` for the batch status update call. |

## Interfaces / Contracts
```typescript
interface ProductStagingRow {
  // ... existing fields ...
  _offerId: string;
  _sourceId: string;
}
```

## Testing Strategy
| Layer | What to Test | Approach |
|---|---|---|
| Unit (`staging-processor.service.spec.ts`) | Pending record extraction filtering (`attempts < 3`, `status` IN `UNPROCESSED`, `FAILED`). | Mock operational db queries returning test capture payloads. |
| Unit (`staging-processor.service.spec.ts`) | Incrementing attempts and setting `FAILED` on transformation errors. | Mock operational db update, throw error in transform, verify update arguments. |
| Unit (`dw-loader.service.spec.ts`) | Bulk marking captures as `PROCESSED` after successful load. | Mock `OperationalPrismaService.rawCapture.updateMany` and check invoked arguments. |

## Threat Matrix
`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.`

## Migration / Rollout
Prisma migration required:
`npx prisma migrate dev --name add_raw_capture_queue_fields --schema=prisma/operational/schema.prisma`
No custom migration script is required as default values `UNPROCESSED` and `attempts = 0` are backfilled automatically by PostgreSQL.

## Open Questions
None.
