# Design: Fase 1a — Modelo Operacional

## Technical Approach

Add 4 new Prisma models to `backend/prisma/operational/schema.prisma` plus a join table for category-source mappings. Implement as 4 new NestJS modules under `backend/src/modules/` following the existing controller/service/Prisma pattern. Fuzzy brand matching uses raw SQL via `$queryRaw` with pg_trgm. Materialized `path` column for O(1) category ancestry. RawCapture upsert via Prisma's `upsert()` on composite unique.

## Architecture Decisions

### Decision: Module location

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `backend/src/domain/` (proposal) | New top-level dir, diverges from all existing modules | `backend/src/modules/` — follows existing codebase convention (DomainsModule, ProductsModule, AuthModule all live here) |
| `backend/src/modules/` | Consistent, reuses PrismaModule, same DI wiring | **Chosen** — zero new infrastructure |

### Decision: Source status as Prisma enum

| Option | Tradeoff | Decision |
|--------|----------|----------|
| String column | No type safety, no DDL-level constraint | **Prisma enum** `SourceStatus { INACTIVE ACTIVE ERROR }` — standard NestJS pattern, validated at DB level |

### Decision: Category materialized path

| Option | Tradeoff | Decision |
|--------|----------|----------|
| ltree | Specialized type, requires extension, Prisma has no native ltree support | **Text** `path` column — simple, Prisma-native, depth ≤ 6 so no perf concern. Service layer parses `/`-delimited IDs for ancestors/descendants |
| text (chosen) | Slightly more app logic | |

### Decision: Brand fuzzy matching

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Raw SQL `$queryRaw` with `similarity()` | Bypasses Prisma type safety for this query, but pg_trgm is SQL-only by nature | **Chosen** — pg_trgm has no Prisma abstraction |
| Load all brands and match in-app | N+1, leaks brand list | Rejected |

### Decision: RawCapture upsert

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Prisma `upsert()` with `@@unique([offerId, sourceId])` | One atomic call, no manual conflict resolution | **Chosen** — matches existing ProductsService upsert pattern. Composite unique enforces identity invariant |

## Data Model

```prisma
enum SourceStatus {
  INACTIVE
  ACTIVE
  ERROR
}

model Source {
  id        String       @id @default(uuid()) @db.Uuid
  code      String       @unique
  name      String
  baseUrl   String
  status    SourceStatus @default(INACTIVE)
  config    Json         @default("{}")
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  categoryMappings CategorySourceMapping[]
  rawCaptures      RawCapture[]
}

model Category {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  parentId  String?  @db.Uuid
  parent    Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  path      String   @default("/")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sourceMappings CategorySourceMapping[]

  @@index([path])
}

model CategorySourceMapping {
  id         String   @id @default(uuid()) @db.Uuid
  categoryId String   @db.Uuid
  category   Category @relation(fields: [categoryId], references: [id])
  sourceId   String   @db.Uuid
  source     Source   @relation(fields: [sourceId], references: [id])
  remoteCode String?

  @@unique([categoryId, sourceId])
  @@index([sourceId])
}

model Brand {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique
  aliases   String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model RawCapture {
  id         String   @id @default(uuid()) @db.Uuid
  offerId    String
  sourceId   String   @db.Uuid
  source     Source   @relation(fields: [sourceId], references: [id])
  payload    Json
  capturedAt DateTime @db.Timestamptz(3)
  createdAt  DateTime @default(now())

  @@unique([offerId, sourceId])
  @@index([sourceId])
  @@index([capturedAt])
}
```

## Data Flow

```
Controller → Service → OperationalPrismaService (global) → PostgreSQL
                              │
                     Raw SQL via $queryRaw
                     (brand fuzzy match only)
                              │
                     pg_trgm extension
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/operational/schema.prisma` | Modify | Add Source, Category, CategorySourceMapping, Brand, RawCapture models + enums |
| `backend/prisma/operational/migrations/` | Create | `prisma migrate dev` generates new migration incl. `CREATE EXTENSION pg_trgm` |
| `packages/contracts/src/sources/` | Create | DTOs: CreateSourceDto, UpdateSourceDto, SourceResponseDto + barrel |
| `packages/contracts/src/categories/` | Create | DTOs: CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto + barrel |
| `packages/contracts/src/brands/` | Create | DTOs: CreateBrandDto, UpdateBrandDto, BrandResponseDto, FuzzyMatchResultDto + barrel |
| `packages/contracts/src/raw-captures/` | Create | DTOs: IngestRawCaptureDto, RawCaptureResponseDto + barrel |
| `packages/contracts/src/index.ts` | Modify | Add re-exports for new modules |
| `backend/src/modules/sources/` | Create | Module, controller, service |
| `backend/src/modules/categories/` | Create | Module, controller, service (path helpers) |
| `backend/src/modules/brands/` | Create | Module, controller, service (fuzzy match) |
| `backend/src/modules/raw-captures/` | Create | Module, controller, service (upsert) |
| `backend/src/app.module.ts` | Modify | Import new modules |

## Interfaces / Contracts

### FuzzyMatchResult

```typescript
interface FuzzyMatchResult {
  brand: Brand | null;
  similarity: number;
  lowConfidence: boolean; // true when 0.6 < similarity < 0.75
}
```

### Category tree helpers

```typescript
// Service layer
async getAncestors(id: string): Promise<Category[]> // path.split('/').filter(Boolean).map(lookup)
async getDescendants(id: string): Promise<Category[]> // where path startsWith `${rootPath}/`
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Source CRUD, Category path logic, Brand fuzzy matching, RawCapture upsert | Jest service specs with `OperationalPrismaService` mock |
| Integration | pg_trgm similarity returns correct brands | Real PostgreSQL testcontainers or test DB with pg_trgm enabled |
| Integration | Category ancestry queries via path | Prisma `findMany` with `startsWith` on path column |
| E2E | Full upsert + re-fetch cycle for RawCapture | Supertest against running NestJS app |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary modified.

## Migration / Rollout

1. Run raw SQL: `CREATE EXTENSION IF NOT EXISTS pg_trgm`
2. `pnpm prisma migrate dev --name add_fase1a_operational_models`
3. Dedicated migration for pg_trgm GiST index on Brand.name and Brand.aliases:

```sql
CREATE INDEX IF NOT EXISTS idx_brand_name_trgm ON "Brand" USING GIST (name gist_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_trgm ON "Brand" USING GIN (aliases gin_trgm_ops);
```

4. Deploy new modules in any order — no inter-module dependencies beyond Source (needed by RawCapture FK, CategorySourceMapping)

## Open Questions

None.
