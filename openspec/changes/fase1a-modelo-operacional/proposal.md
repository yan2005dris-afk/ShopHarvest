# Proposal: Fase 1a — Modelo Operacional

## Intent

Phase 0 separated the monolith into operational (PostgreSQL) and analytics (ClickHouse) databases. Now we need structured operational entities to store scraped product offers with proper taxonomy: Source, hierarchical Category, Brand (fuzzy-matched), and RawCapture (latest scrape per offer, overwrite on re-scrape). This enables reliable ingestion and lookup for downstream scraping logic.

## Scope

### In Scope
- **Source** entity: scraping source config (base URL, status, credentials ref)
- **Category** entity: hierarchical multi-level tree (parent_id self-ref), source-specific mappings
- **Brand** entity: fuzzy-matched from raw offer text (no pre-built dictionary required)
- **RawCapture** entity: latest raw scraped payload per offer (overwrite on re-scrape); full history deferred to analytics
- Prisma schema + migrations for operational DB
- Domain services for CRUD + fuzzy brand matching + per-source extraction rules

### Out of Scope
- Product/Offer split (deduplication/merge logic) — Fase 1b
- Analytics dimensions (dim_marca, dim_categoria, dim_fuente, dim_tiempo) — Fase 1b
- Scraper execution logic, scheduling, or orchestrator
- Historical RawCapture retention

## Capabilities

> All capabilities are NEW — no existing specs modified.

### New Capabilities
- `source-management`: CRUD + status for scraping sources
- `category-taxonomy`: Hierarchical category tree + source-to-category mappings
- `brand-extraction`: Fuzzy brand matching from raw offer text
- `raw-capture-ingestion`: Upsert latest raw payload per offer_id

### Modified Capabilities
- None

## Approach

Add four new models to `backend/prisma/operational/schema.prisma` with appropriate indexes:
- `Source`: unique `code`, `baseUrl`, `status`, `config` JSON
- `Category`: `parentId` self-ref (adjacency list), `path` materialized path for ancestry queries, unique `sourceId` `sourceId` composite for mappings
- `Brand`: `name` + `aliases` array for fuzzy matching; trigram index for pg_trgm similarity
- `RawCapture`: unique `offerId`, `sourceId`, `payload` JSONB, `capturedAt` timestamp; upsert on conflict (offerId, sourceId)

Domain services in `backend/src/domain/` implement fuzzy match (pg_trgm similarity > 0.6) and per-source extraction rules (config-driven).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/prisma/operational/schema.prisma` | New | Add 4 models + indexes |
| `backend/prisma/operational/migrations/` | New | Generated migrations |
| `backend/src/domain/source/` | New | Source service + repo |
| `backend/src/domain/category/` | New | Category service + repo + path helpers |
| `backend/src/domain/brand/` | New | Brand service + fuzzy match service |
| `backend/src/domain/raw-capture/` | New | RawCapture service + upsert logic |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Fuzzy matching false positives (wrong brand assigned) | Medium | Threshold tuning (pg_trgm > 0.6), manual review queue for low-confidence matches |
| Hierarchical category depth causing recursive query perf issues | Low | Materialized `path` column (ltree or text) for O(1) ancestry; limit depth to 6 |
| RawCapture upsert race condition on concurrent scrapes | Low | Unique constraint on (offerId, sourceId) + ON CONFLICT DO UPDATE |

## Rollback Plan

1. Revert Prisma migrations: `pnpm prisma migrate reset --force` (operational DB only)
2. Drop new domain service folders
3. No analytics DB impact — completely separate

## Dependencies

- PostgreSQL `pg_trgm` extension enabled (for brand fuzzy matching)
- Phase 0 complete (operational DB exists and accessible)

## Success Criteria

- [ ] `pnpm prisma migrate dev` runs clean against operational DB
- [ ] CRUD operations work for Source, Category, Brand, RawCapture via domain services
- [ ] Fuzzy brand matching returns correct brand for ≥90% of known-brand test fixtures
- [ ] RawCapture upsert overwrites previous payload on same `offerId` + `sourceId`
- [ ] Category path queries (ancestors/descendants) return in <5ms on 10k nodes