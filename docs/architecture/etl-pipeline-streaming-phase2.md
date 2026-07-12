# Phase 2: ETL Pipeline Streaming Batches with Message Queue

**Status**: Idea / Backlog — Separate SDD after Phase 1 completion  
**Related**: Phase 1 `etl-management-dashboard-auth` (UI only, exposes existing pipeline)

---

## Problem Statement

Current `DwLoaderService.load()`:
- Reads entire `all_products.json` + `stg_encuesta.json` into memory
- `TRUNCATE TABLE dw.fact_*, dw.dim_producto CASCADE`
- Inserts row-by-row in single transaction
- **Issues**: OOM risk on large datasets, long-running TX locks tables, no progress visibility, no resume on failure, no parallelism

---

## Target Architecture

```
┌──────────────┐     Push micro-batches      ┌──────────────────┐
│  Scrapers    │ ─────────────────────────►  │   Message Queue  │
│ (Playwright) │  { batchId, items[100] }    │  (Redis Streams  │
└──────────────┘                              │   or RabbitMQ)   │
                                              └────────┬─────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────┐
                    ▼                                  ▼                  ▼
             ┌─────────────┐                   ┌─────────────┐    ┌─────────────┐
             │  Worker 1   │                   │  Worker 2   │    │  Worker N   │
             │ (consumer)  │                   │ (consumer)  │    │ (consumer)  │
             └──────┬──────┘                   └──────┬──────┘    └──────┬──────┘
                    │                                 │                  │
                    └─────────────────────┬───────────┘                  │
                                          ▼                              ▼
                                 ┌─────────────────────┐
                                 │  Batch UPSERT TXN   │
                                 │  (100 rows/batch)   │
                                 └──────────┬──────────┘
                                            ▼
                                     ┌──────────────┐
                                     │    DW DB     │
                                     │  (PostgreSQL) │
                                     └──────────────┘
```

---

## Key Components

### 1. Queue Infrastructure
- **Redis Streams** (preferred): already in stack?, lightweight, consumer groups, exactly-once semantics
- **RabbitMQ** (alternative): dead-letter queues, priority queues, more mature ops tooling

### 2. Producer: `EtlSchedulerService` → `QueueProducer`
```typescript
// Instead of: await this.pipelineService.runAll()
// Produce batches to queue:
await this.queueProducer.sendBatches('etl.products', productBatches);
await this.queueProducer.sendBatches('etl.surveys', surveyBatches);
```

### 3. Consumer: `BatchProcessorWorker` (N instances)
```typescript
@Injectable()
export class BatchProcessorWorker {
  async processBatch(batch: EtlBatch): Promise<BatchResult> {
    // Single TXN per batch (100-500 rows)
    // Checkpoint batchId on success
    // Retry with backoff on failure
    // Dead-letter after N retries
  }
}
```

### 4. Checkpointing / Resume
- Track `lastProcessedBatchId` per run in `EtlRun` table
- On worker restart: continue from checkpoint
- Idempotent upserts via `ON CONFLICT DO UPDATE`

### 5. Observability
- Metrics: batches/sec, rows/sec, latency p50/p99, error rate, queue lag
- Logs: structured JSON with batchId, runId, workerId
- Dashboard: Phase 1 UI consumes SSE from queue consumer progress

---

## Migration Path

| Step | Action |
|------|--------|
| 1 | Add queue infra (Redis Streams) to docker-compose / Render |
| 2 | Implement `QueueProducer` + `BatchProcessorWorker` |
| 3 | Feature flag: `ETL_STREAMING_ENABLED=false` |
| 4 | Shadow mode: produce to queue AND run old pipeline, compare results |
| 5 | Flip flag, deprecate `DwLoaderService.load()` |
| 6 | Remove staging JSON file dependency |

---

## Open Decisions

| Decision | Options | Leaning |
|----------|---------|---------|
| Queue tech | Redis Streams vs RabbitMQ | Redis Streams (simpler, in stack?) |
| Batch size | 100 / 500 / 1000 rows | 100-200 (balance TXN size vs overhead) |
| Parallelism | Fixed N workers vs KEDA autoscaling | Start fixed (3-5), KEDA later |
| Exactly-once | Transactional outbox vs idempotent upserts | Idempotent upserts (simpler) |
| Dead letter | Separate queue + alert | Yes, required |

---

## References

- Phase 1 SDD: `etl-management-dashboard-auth` (UI, SSE, auth)
- Current impl: `backend/src/modules/pipeline/etl/dw-loader.service.ts`
- Scheduler: `backend/src/modules/pipeline/etl-scheduler.service.ts`