# Design — Multi-Scraper Menus and Control Panel

> **Change:** `multi-scraper-menus`
> **Scope:** Authenticated `/scrapers` control panel (7 sources), background run triggers, run-history polling, products unified filters.
> **Branch:** `feat/bi-dashboard-analytics` (preserved).
> **Stack:** NestJS 11 + Prisma 7 (backend) · Angular 22 standalone + signals (frontend) · `@web-scraping/contracts` (shared types).

---

## 1. Architectural Decisions

### 1.1. Auth posture on `POST /scrape/:source` and `GET /runs` — DECISION

**Chosen approach:** **Remove `@Public()` from those two specific routes; reuse the existing global `JwtAuthGuard`** by leaving them un-annotated. The class-level `@Public()` on `PipelineController` is kept, and a method-level `@Public()` is added to `sources`, `staging`, `load-dw`, `run-all` so the BI dashboard's public triggers still work.

**Why this over the alternatives:**

| Option | Verdict | Reason |
| -------- | --------- | -------- |
| (a) Remove `@Public()` on the two routes (rely on global `JwtAuthGuard`) | **CHOSEN** | Reuses the global guard. No new guard class. The frontend already has `authInterceptor` registered in `app.config.ts:provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))` which auto-attaches the Bearer token from `localStorage['vs_token']`. Zero new wiring. |
| (b) Add `@AdminOnly()` custom guard | Rejected | With a single-default-user model and no roles table, this guard collapses into "is authenticated? → yes" — code duplication of `JwtAuthGuard` with no added value. |
| (c) Leave `@Public()` and rely on network isolation | **Rejected** | The task brief explicitly disallows this. The dashboard is reachable without a JWT, and any deep-link or curl call to these routes can drive Playwright, so the privileged endpoints must enforce auth at the server, not the UI shell. |

**Tradeoffs accepted:**

- Calls to `/scrape/:source` and `/runs` now require a JWT. A user who clears `localStorage` will get 401 instead of being silently accepted — this is the desired behavior.
- The two method-level `@Public()` decorators add a small amount of clutter; mitigated by a one-line class-level JSDoc warning future contributors not to drop the per-method decorators.

**Spec linkage:** Satisfies the SPEC's "Known Risk" call-outs in `scraper-background-execution` §3.5 and `etl-run-history-logs` §3.4 (which both acknowledged the gap).

---

### 1.2. Playwright concurrency — DECISION

**Chosen approach:** **In-memory `Map<PipelineSource, EtlRun>` semaphore in `PipelineService` with N=1 permit per source, AND a pre-insert DB read that returns the existing `EtlRun` if one is already in `RUNNING`.** Never returns 409 to the client for a duplicate trigger during the polling window.

**Why this over the alternatives:**

| Option | Verdict | Reason |
| -------- | --------- | -------- |
| (a) In-memory semaphore with N permits (per source, N=1) + DB reuse | **CHOSEN** | The semaphore gives zero-cost mutual exclusion inside one Node process. The DB read catches the case where the process restarted or where a second instance exists. The combination satisfies the spec's "POST SHOULD be idempotent … acceptable by design because the frontend disables the button" requirement without ever surfacing a 4xx to a UI that already prevented the click. Reuses the exact `findFirst({ where: { source, status: 'RUNNING' }})` pattern from `etl-scheduler.service.ts:57`. |
| (b) Persistent queue table that serializes runs per source | Rejected as primary | A queue implies async dispatch (enqueue → worker dequeue → run). The current pipeline runs scrapes inline in the Nest process; adding a queue introduces a worker abstraction that the spec explicitly scopes out. We get most of the benefit of (b) by reusing the existing `EtlRun` table as a soft lock. |
| (c) Reject concurrent runs with 409, let UI retry | Rejected | Hurts UX for a corner case the UI already prevents. Treats a UI bug as a server fault. The spec's idempotency clause is essentially written to reject (c). |

**Tradeoffs accepted:**

- If the DB and the in-memory map disagree (e.g., process restart during a scrape), the next trigger may briefly spawn a second worker — the DB will end up with two `SUCCESS` rows on `encuesta` source. Mitigation: the `EtlProduct.@@unique([source, sourceId])` constraint already protects downstream data integrity (no duplicate products), so the worst case is a wasted scrape and a duplicate terminal row.
- The semaphore is process-local; a future horizontally-scaled deploy will need a Redis or DB advisory lock. Flagged as a follow-up.

**Spec linkage:** Satisfies the proposal risk row "Server Overload" — backend caps each source at N=1; the proposal spec (`scraper-background-execution` §3.2) covers the UI-side disable.

---

### 1.3. `EtlRun` state machine — known contract gap

The spec requires a 4-state lifecycle `queued → running → (success | failed)`. The Prisma schema defines only `EtlRunStatus.{ RUNNING, SUCCESS, FAILED }` (see `backend/prisma/schema.prisma:73`). The wire DTO therefore maps:

- DB `RUNNING` → wire `'running'` (always)
- DB `SUCCESS` → wire `'success'`
- DB `FAILED`  → wire `'failed'`

**The `queued` state from the spec is not realizable on the wire without a Prisma migration** (adding `QUEUED` to the enum and inserting it in the controller before dispatching the work, plus a background dispatcher). For this change, the row is inserted with `RUNNING` synchronously before the heavy scrape begins; the user sees `running` immediately. The spec's `queued` semantic is preserved operationally (the row is created before work begins) but not as a distinct wire value. This is flagged as a follow-up migration in §10.

---

### 1.4. Frontend run-state representation — DECISION

**Chosen:** `EtlRunSummary.state` is a lowercase union (`'queued' | 'running' | 'success' | 'failed'`) in `@web-scraping/contracts`. The backend maps the 3-state DB enum to this 4-state union (`RUNNING` → `'running'`; `'queued'` is reserved for the future migration). The frontend treats `queued` and `running` identically for the `canRun` computation (both disable the button).

---

### 1.5. Polling transport — DECISION

**Chosen:** HTTP polling at a fixed **5000 ms** interval using `setInterval` initiated by an `effect()` on the scrapers page. No SSE / WebSocket — the spec §etl-run-history-logs §1 explicitly scopes them out. The interval is `clearInterval`'d in the same `effect()` cleanup when the latest poll contains only terminal runs.

---

## 2. Backend Architecture

### 2.1. Module changes (`backend/src/modules/pipeline/`)

- **No new module.** `PipelineModule` already provides `PrismaService` (transitively, via `app.module` → `PrismaModule`), `PipelineService`, and the existing data sources.
- `PipelineService` is extended with three new methods and one in-memory state field. `PrismaService` is added to the constructor.
- `PipelineController` is reorganized to: drop the class-level `@Public()`, add method-level `@Public()` to four existing methods, and leave `scrapeOne` + the new `getRuns` un-annotated (so `JwtAuthGuard` covers them).

### 2.2. `PipelineService` shape (TypeScript)

```ts
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  /** In-memory per-source soft-lock, refilled from DB on boot. */
  private readonly inflightBySource = new Map<PipelineSource, string /* EtlRun.id */>();

  constructor(
    @Inject(DW_LOADER) private readonly dwLoader: IDwLoader,
    @Inject(DATA_SOURCES) private readonly dataSources: IDataSource[],
    @Inject(STAGING_PROCESSOR) private readonly staging: IStagingProcessor,
    private readonly prisma: PrismaService,          // NEW
  ) {}

  // ─── existing methods unchanged ────────────────────────────
  getAvailableSources(): PipelineSource[] { /* ... */ }
  async runScraper(source, config): Promise<ScrapeResult> { /* ... */ }
  async runStaging(opts?): Promise<StagingResult> { /* ... */ }
  async loadDw(opts?): Promise<LoadResult> { /* ... */ }
  async runAll(opts?): Promise<PipelineRunSummary> { /* ... */ }

  // ─── new methods ───────────────────────────────────────────

  /**
   * Insert an EtlRun row synchronously (state: RUNNING), then dispatch
   * the heavy scrape WITHOUT awaiting it. Resolves with the newly
   * created (or reused, if a sibling trigger already exists) summary.
   * Maps the DB enum to the wire union in `EtlRunSummaryDto`.
   */
  async runSourceAsync(source: PipelineSource): Promise<EtlRunSummaryDto> { /* ... */ }

  /**
   * Paginated read of EtlRun history, ordered by startedAt DESC.
   * @param source optional filter (one of PipelineSource)
   * @param limit  page size, default 50, max 100
   * @param cursor (startAfter id) — opaque for cursor pagination
   */
  async listRuns(query: EtlRunsQueryDto): Promise<PaginatedEtlRunsResponseDto> { /* ... */ }

  /** Seed inflightBySource at boot from any RUNNING row in the DB. */
  async onApplicationBootstrap(): Promise<void> { /* ... */ }

  /** Internal: clear the in-memory lock when a row transitions to terminal. */
  private markInflightEnded(source: PipelineSource, runId: string): void { /* ... */ }
}
```

The `runSourceAsync` flow:

```text
1. fast-path in-memory check: inflightBySource.has(source) → return cached summary
2. DB soft-lock check: prisma.etlRun.findFirst({ where: { source, status: 'RUNNING' } })
   ├── found → map row to EtlRunSummaryDto, return WITHOUT a new POST body.
   └── not found → prisma.etlRun.create({ data: { source, status: 'RUNNING' } })
3. Update inflightBySource.set(source, run.id)
4. (detached, no await) adapter.run(sourceConfig).then(updateRunSuccess).catch(updateRunFailed)
   └── On terminal state: markInflightEnded(source, run.id) and clear cache entry.
```

The detached promise runs after the HTTP response is flushed — satisfies the spec §scraper-background-execution §3.4 ("HTTP response MUST be returned immediately").

### 2.3. `PipelineController` shape (TypeScript)

```ts
@ApiTags('Pipeline')
// Class-level @Public() REMOVED. Per-method decorators below.
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Public()
  @Get('sources')
  getSources(): PipelineSourceDescriptorDto[] { /* maps enum → DTO list */ }

  // NO @Public() — JwtAuthGuard applies (DECISION 1.1).
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('scrape/:source')
  scrapeOne(@Param('source') source: string): Promise<RunScraperResponseDto> {
    return this.pipelineService.runSourceAsync(validateSource(source));
  }

  // NO @Public() — JwtAuthGuard applies (DECISION 1.1).
  @Get('runs')
  listRuns(@Query() q: EtlRunsQueryDto): Promise<PaginatedEtlRunsResponseDto> {
    return this.pipelineService.listRuns(q);
  }

  @Public()
  @Post('staging') /* unchanged body */ …
  @Public()
  @Post('load-dw') /* unchanged body */ …
  @Public()
  @Post('run-all') /* unchanged body */ …
}
```

### 2.4. New DTOs (backend, see also §4 for shared contract DTOs)

```ts
// backend/src/modules/pipeline/dto/etl-run-summary.dto.ts
export class EtlRunSummaryDto {
  @Expose() id!: string;
  @Expose() source!: string;
  @Expose() state!: EtlRunState;                      // union: 'queued'|'running'|'success'|'failed'
  @Expose() startedAt!: string;                       // ISO 8601 UTC
  @Expose() finishedAt!: string | null;
  @Expose() error!: string | null;                    // mapped from errorSummary
}

// backend/src/modules/pipeline/dto/etl-runs-query.dto.ts
export class EtlRunsQueryDto {
  @IsOptional() @IsString() source?: PipelineSource;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit?: number;  // default 50
  @IsOptional() @IsString() cursor?: string;          // last id from previous page
}

// backend/src/modules/pipeline/dto/run-scraper-response.dto.ts
export class RunScraperResponseDto {
  @Expose() id!: string;
  @Expose() accepted!: boolean;                       // always true on 2xx in this change
}

// backend/src/modules/pipeline/dto/paginated-etl-runs.dto.ts
export class PaginatedEtlRunsResponseDto {
  @Expose() @Type(() => EtlRunSummaryDto) items!: EtlRunSummaryDto[];
  @Expose() nextCursor!: string | null;
}

// backend/src/modules/pipeline/dto/pipeline-source-descriptor.dto.ts
export class PipelineSourceDescriptorDto {
  @Expose() id!: string;                              // PipelineSource value
  @Expose() label!: string;                           // human label, see §4
  @Expose() description!: string;
  @Expose() kind!: 'playwright' | 'extension' | 'api' | 'csv';
}
```

Source `kind` mapping is static and lives in `backend/src/modules/pipeline/source-meta.ts`:

```ts
export const SOURCE_KIND: Record<PipelineSource, PipelineSourceDescriptorDto['kind']> = {
  [PipelineSource.MERCADOLIBRE]: 'playwright',
  [PipelineSource.ALIEXPRESS]:   'playwright',
  [PipelineSource.TEMU]:         'extension',
  [PipelineSource.SHEIN]:        'extension',
  [PipelineSource.API_RATES]:    'api',
  [PipelineSource.CSV_DATASET]:  'csv',
  [PipelineSource.ENCUESTA]:     'csv',
};
```

Labels live in the same file (English labels per `Persona Scope`):

```ts
export const SOURCE_LABELS: Record<PipelineSource, { label: string; description: string }> = {
  [PipelineSource.MERCADOLIBRE]: { label: 'MercadoLibre Ecuador', description: 'Playwright scrape of MercadoLibre Ecuador listings.' },
  [PipelineSource.ALIEXPRESS]:   { label: 'AliExpress (mock)',     description: 'Playwright scrape of books.toscrape.com as AliExpress mock.' },
  [PipelineSource.TEMU]:         { label: 'Temu',                  description: 'Extension-driven extraction from Temu pages.' },
  [PipelineSource.SHEIN]:        { label: 'Shein',                 description: 'Extension-driven extraction from Shein pages.' },
  [PipelineSource.API_RATES]:    { label: 'Exchange Rates API',    description: 'Daily FX rate consumer (USD, EUR, GBP, BRL, ARS).' },
  [PipelineSource.CSV_DATASET]:  { label: 'CSV Dataset',           description: 'Reference CSV loader for offline product catalog.' },
  [PipelineSource.ENCUESTA]:     { label: 'Survey (Google Forms)', description: 'Google Forms survey CSV loader.' },
};
```

### 2.5. ListRuns semantics

`listRuns` issues a single Prisma query with `where`, `orderBy: { startedAt: 'desc' }`, `take: limit + 1`. If the result has `limit + 1` rows, the last id is set on `nextCursor` and the row is dropped — so the next page can `cursor` past it. Returns UTC ISO strings via `plainToInstance(EtlRunSummaryDto, row, { excludeExtraneousValues: true })` after mapping `status: 'RUNNING' → state: 'running'`, `errorSummary → error`.

Indexes used (already in schema): `@@index([status, startedAt(sort: Desc)])` for the filtered case; `EtlRun.@@index` covers the order-by without filtering.

---

## 3. Frontend Architecture

### 3.1. Component tree

```
ScrapersPageComponent                                     (NEW)
├── ScraperCardComponent × N                             (NEW)
│     • label, description, kind badge
│     • Run button (disabled binding to canRun(source))
│     • last-run inline summary
└── RunHistoryListComponent                              (NEW)
      • table / list rows with state badges
      • empty state message
      • "View products" cross-link to /products?source=<id>
```

`ScrapersPageComponent` is a lazy-loaded standalone component declared on `/scrapers`. `ScraperCardComponent` and `RunHistoryListComponent` are siblings, both standalone, both `OnPush`.

### 3.2. Service: `PipelineService`

Location: `frontend/src/app/services/pipeline.service.ts` (NEW). Mirrors the existing pattern in `auth.service.ts` (signals + `inject()`). Module: `@web-scraping/contracts/pipeline` is imported for request/response DTO types.

```ts
@Injectable({ providedIn: 'root' })
export class PipelineService {
  private readonly http = inject(HttpClient);

  /** Hydrated by ScraperCardComponent on mount. */
  readonly sources = signal<PipelineSourceDescriptorDto[]>([]);
  readonly runHistory = signal<EtlRunSummaryDto[]>([]);
  readonly sourcesLoading = signal<boolean>(false);
  readonly sourcesError = signal<string | null>(null);

  /**
   * Derived: set of source ids that have a non-terminal row in runHistory.
   * `queued` and `running` both block the button.
   */
  readonly inFlightSources = computed<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const run of this.runHistory()) {
      if (run.state === 'queued' || run.state === 'running') set.add(run.source);
    }
    return set;
  });

  /** Per-source predicate — memolized in template by `track source.id`. */
  canRun(sourceId: string): boolean {
    return !this.inFlightSources().has(sourceId);
  }

  getSources(): Observable<PipelineSourceDescriptorDto[]> { … }           // GET /api/pipeline/sources
  triggerScrape(source: PipelineSource): Observable<RunScraperResponseDto> {
    return this.http.post<RunScraperResponseDto>(`/api/pipeline/scrape/${source}`, {});
  }
  getRuns(filter?: EtlRunsFilter): Observable<PaginatedEtlRunsResponseDto> {
    let params = new HttpParams();
    if (filter?.source) params = params.set('source', filter.source);
    if (filter?.limit)  params = params.set('limit',  String(filter.limit));
    if (filter?.cursor) params = params.set('cursor', filter.cursor);
    return this.http.get<PaginatedEtlRunsResponseDto>('/api/pipeline/runs', { params });
  }
}
```

`EtlRunsFilter` is a TS type alias for the optional shape `{ source?, limit?, cursor? }` — see §4.

### 3.3. Scrapers page state machine

```ts
@Component({
  selector: 'app-scrapers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScraperCardComponent, RunHistoryListComponent, /* RouterLink */],
  templateUrl: './scrapers-page.component.html',
})
export class ScrapersPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pipeline = inject(PipelineService);
  private readonly router = inject(Router);

  readonly sources = this.pipeline.sources;
  readonly runHistory = this.pipeline.runHistory;
  readonly inFlight = this.pipeline.inFlightSources;

  private readonly POLL_MS = 5000;

  ngOnInit(): void {
    this.loadSources();
    this.refreshRuns();                  // initial poll
    this.startPolling();
  }

  private loadSources(): void {
    this.pipeline.sourcesLoading.set(true);
    this.pipeline.sourcesError.set(null);
    this.pipeline.getSources()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.pipeline.sources.set(list); this.pipeline.sourcesLoading.set(false); },
        error: err => { this.pipeline.sourcesError.set(extractError(err)); this.pipeline.sourcesLoading.set(false); },
      });
  }

  private startPolling(): void {
    const timer$ = interval(this.POLL_MS).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(() => this.pipeline.getRuns()),
      tap(res => this.pipeline.runHistory.set(res.items)),
    );

    timer$.subscribe();

    // Stop-polling guard: when last response is fully terminal, cancel the interval.
    effect(() => {
      const any = this.pipeline.runHistory().some(r => r.state === 'queued' || r.state === 'running');
      if (!any && timerActive) {
        clearInterval$();   // small adapter; we wrap interval() in a Subject for clean teardown
        timerActive = false;
      } else if (any && !timerActive) {
        // Restart — covered by re-subscribing to interval$
      }
    });
  }
  // … template helpers
}
```

The polling effect uses `interval()` from RxJS wrapped in `takeUntilDestroyed(this.destroyRef)` plus a manual teardown when no non-terminal runs remain. The `error` case is `tap(res → swallow, err → swallow and keep timer alive)` — the spec §etl-run-history-logs §4 NFR mandates "Errors during a poll MUST be retried on the next tick rather than tearing down the polling loop." Stale-response cancellation is achieved by `switchMap` inside `timer$`.

### 3.4. Products page filter wiring

`ProductsComponent` (existing) gets:

- Two new signals: `selectedSource = toSignal(route.queryParamMap.pipe(map(p => p.get('source'))))` and `selectedType = toSignal(route.queryParamMap.pipe(map(p => p.get('type'))))`.
- A new method `onFilterChange(dim: 'source'|'type', value: string|null)` that does:

  ```ts
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { [dim]: value || null },
    queryParamsHandling: 'merge',        // preserves the other filter
  });
  ```

- A `loadProducts()` follow-up: read the new query-param signals and pass them into `apiService.getProducts(true, { source, type })`. Adds the optional `source` and `type` filter to the wire request.
- Dropdown options derived from `computed()` on the loaded `products[]` response — distinct values for `source` and a new `category` field. `category` is read off the response if present; if the backend list endpoint does not yet expose it, we add a TypeScript-side projection that maps from `rawData.category` (per the existing schema's `rawData Json?`).

If the backend `GET /api/products` does not currently filter by `source`/`type` (check during `sdd-tasks`/`sdd-apply`; the existing `ProductQueryDto` has only `includeHistory` and `domainRuleId`), the design adds two optional string fields `source` and `type` to `ProductQueryDto` and a where-clause branch in the products controller that maps them to the `EtlProduct.source` table (the source of truth for "where a product came from"). The existing `public.Product` table does not store `source` or `category` directly — only `rawData Json?` — so the design reuses `EtlProduct` as the canonical table for filterable product listings and reads from `dw.dim_fuente.nombre_fuente` for human labels. The products service endpoint is extended to support `?source=<id>&type=<category>` against `EtlProduct` rows. This is a small but important structural alignment with §SCD-products-unified-3.2.

### 3.5. Routes & shell

`frontend/src/app/app.routes.ts` — add:

```ts
{
  path: 'scrapers',
  canActivate: [authGuard],
  loadComponent: () => import('./pages/scrapers/scrapers-page.component').then(m => m.ScrapersPageComponent),
},
```

`frontend/src/app/app.html` — add inside the `sidebar-nav` block, after the existing "Products" `<a>`:

```html
<a routerLink="/scrapers" routerLinkActive="active" class="nav-item">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M8 21h8M12 17v4M7 9h10M9 9V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/>
  </svg>
  <span>Scrapers Definidos</span>
</a>
```

`frontend/src/app/app.ts` — no logic changes needed (the link uses `RouterLink`, already imported).

---

## 4. Contracts Package Additions

All new files in `packages/contracts/src/pipeline/` follow the established convention: camelCase, `.js` import suffixes, barrel re-exports from `index.ts`.

### 4.1. `packages/contracts/src/pipeline/etl-run.types.ts` (NEW)

```ts
/** Wire-state union, kept lower-case to match spec language. */
export type EtlRunState = 'queued' | 'running' | 'success' | 'failed';

/** Source-of-truth mapping: which execution mechanism a source uses. */
export type PipelineSourceKind = 'playwright' | 'extension' | 'api' | 'csv';

export interface PipelineSourceDescriptorDto {
  /** Matches PipelineSource enum value (kebab-lowercase). */
  id: string;
  /** Human-readable English label. */
  label: string;
  /** One-line English summary. */
  description: string;
  /** Execution-mechanism tag, drives UI gating hints. */
  kind: PipelineSourceKind;
}

export interface EtlRunSummaryDto {
  /** UUID of the EtlRun row. */
  id: string;
  /** PipelineSource enum value as a string. */
  source: string;
  /** Wire state — see §1.4 for the DB mapping. */
  state: EtlRunState;
  /** ISO 8601 UTC timestamp. */
  startedAt: string;
  /** ISO 8601 UTC timestamp, or null while non-terminal. */
  finishedAt: string | null;
  /** Failure summary, or null on success / non-terminal. */
  error: string | null;
}

export interface RunScraperResponseDto {
  id: string;
  /** Always true on 2xx in this change. Reserved for future async-ack semantics. */
  accepted: boolean;
}

export interface PaginatedEtlRunsResponseDto {
  items: EtlRunSummaryDto[];
  /** Opaque cursor for the next page, null when no further pages. */
  nextCursor: string | null;
}

/** Query filter for GET /api/pipeline/runs — camelCase in TS. */
export interface EtlRunsFilter {
  source?: string;
  limit?: number;
  cursor?: string;
}

/** Query filter for GET /api/products (products-unified-filtering). */
export interface ProductsFilter {
  source?: string;
  type?: string;
}
```

### 4.2. `packages/contracts/src/pipeline/index.ts` (MODIFIED)

Add to the barrel:

```ts
export type {
  EtlRunState,
  PipelineSourceKind,
  PipelineSourceDescriptorDto,
  EtlRunSummaryDto,
  RunScraperResponseDto,
  PaginatedEtlRunsResponseDto,
  EtlRunsFilter,
  ProductsFilter,
} from './etl-run.types.js';
```

### 4.3. Reuse — no new enum

`PipelineSource` enum already exists at `packages/contracts/src/pipeline/pipeline.source.ts:8-15`. The 7 values are the source of truth; this design does not add or rename members.

---

## 5. Data Flow

### 5.1. Happy path: user triggers a MercadoLibre scrape

```
[1] User clicks Run on ScraperCardComponent(mercadolibre)
      └─> button is enabled iff canRun('mercadolibre') === true
[2] ScraperCardComponent invokes pipeline.triggerScrape('mercadolibre')
[3] HttpClient → POST /api/pipeline/scrape/mercadolibre
      • authInterceptor attaches Bearer from localStorage
      • JwtAuthGuard on backend validates token
[4] PipelineController.scrapeOne → PipelineService.runSourceAsync
      • sem check: !inflightBySource.has(source) ✓
      • DB soft-lock check: findFirst({ source, status: 'RUNNING' }) === null ✓
      • prisma.etlRun.create({ source, status: 'RUNNING' })
      • inflightBySource.set(source, run.id)
[5] (DETACHED) pipelineService.runScraper(source, sourceConfig)
      └─ on success: etlRun.update({ status: 'SUCCESS', finishedAt, errorSummary: null })
      └─ on failure: etlRun.update({ status: 'FAILED',  finishedAt, errorSummary: msg.slice(0,500) })
      └─ on terminal: markInflightEnded(source, run.id)
[6] PipelineController returns 202 { id, accepted: true }
[7] Frontend gets the response, immediately:
      • runHistory.unshift(syntheticQueuedRow)   // optimistic, see §1.4
      • button becomes disabled
[8] 5000 ms later, polling tick:
      • GET /api/pipeline/runs → array including the active row
      • runHistory updates with the new EtlRunSummaryDto (state: 'running')
      • button stays disabled (canRun → false)
[9] Eventually the detached run finishes; next poll shows state: 'success'
      • canRun becomes true → button re-enables
      • polling effect observes "all terminal" and stops
```

### 5.2. Duplicate-trigger path (race)

```
[1] User double-clicks Run.
[2] First click → POST /scrape/mercadolibre, EtlRun.create(row1)
[3] Second click (within milliseconds) → POST /scrape/mercadolibre
      • sem: inflightBySource.has(source) === true  ✓ (in-process catch)
[4] PipelineService.runSourceAsync returns the cached row1 summary.
[5] No second row is created. No 409 is returned.
```

### 5.3. Cross-instance race (future scenario)

```
[1] Two Nest processes, A and B.
[2] A's POST /scrape/mercadolibre → EtlRun.create(row1), inflight[A] = row1.
[3] B's POST /scrape/mercadolibre:
      • sem in B is empty
      • DB findFirst({ source, status: 'RUNNING' }) → row1
      • B returns row1 summary instead of creating row2.
```

---

## 6. Spec → Design Traceability

| Spec | Requirement IDs | How the design satisfies |
| ------ | ----------------- | -------------------------- |
| `scrapers-defined-list` | SCD-scrapers-defined-list-3.1 (fetch), -3.2 (component, signals, OnPush), -3.3 (authGuard, lazy-loaded route), -3.4 (no hardcoding), -4.NFRs | §3.2 service contract, §3.5 route registration, §4.1 `PipelineSourceDescriptorDto` is metadata-driven |
| `scraper-background-execution` | SCD-scraper-background-execution-3.1 (Run action, non-blocking), -3.2 (concurrency guard), -3.3 (error handling), -3.4 (EtlRun synchronously before response), -3.5 (auth), -4.NFR | §2.3 202 + sync insert; §1.1 auth decision; §1.2 concurrency; §3.3 optimistic UI row + computed-disabled button |
| `etl-run-history-logs` | SCD-etl-run-history-logs-3.1 (endpoint, DTO shape), -3.2 (5 s polling lifecycle), -3.3 (UI rendering with state badges), -3.4 (auth posture) | §2.3 `getRuns`, §2.4 DTOs, §3.3 polling effect with terminal-state teardown |
| `products-unified-filtering` | SCD-products-unified-filtering-3.1 (URL-driven), -3.2 (dynamic options), -3.3 (UI behavior), -3.4 (a11y) | §3.4 queryParamMap → signals → router.navigate; computed-derived options; native `<select>` for a11y |

---

## 7. Files Touched (apply phase estimates)

| File | Status | Lines (est.) | Notes |
| ------ | -------- | -------------- | ------- |
| `packages/contracts/src/pipeline/etl-run.types.ts` | NEW | ~60 | Type definitions |
| `packages/contracts/src/pipeline/index.ts` | MODIFIED | +10 | Barrel re-exports |
| `backend/src/modules/pipeline/source-meta.ts` | NEW | ~30 | Static label/kind map |
| `backend/src/modules/pipeline/dto/etl-run-summary.dto.ts` | NEW | ~50 | class-validator + transform |
| `backend/src/modules/pipeline/dto/etl-runs-query.dto.ts` | NEW | ~25 | Query DTO |
| `backend/src/modules/pipeline/dto/run-scraper-response.dto.ts` | NEW | ~20 | Response DTO |
| `backend/src/modules/pipeline/dto/paginated-etl-runs.dto.ts` | NEW | ~20 | Response DTO |
| `backend/src/modules/pipeline/dto/pipeline-source-descriptor.dto.ts` | NEW | ~30 | Response DTO |
| `backend/src/modules/pipeline/pipeline.service.ts` | MODIFIED | +90 / -0 | 3 new methods, onApplicationBootstrap, semaphore field |
| `backend/src/modules/pipeline/pipeline.controller.ts` | MODIFIED | +35 / -10 | New `@Get('runs')`, per-method `@Public()`, 202 on scrapeOne, sources returns DTOs |
| `backend/src/modules/pipeline/adapters/data-sources/*.adapter.ts` | UNCHANGED | 0 | No adapter changes |
| `frontend/src/app/services/pipeline.service.ts` | NEW | ~120 | Signals + HttpClient service |
| `frontend/src/app/pages/scrapers/scrapers-page.component.ts` | NEW | ~140 | OnPush, polling effect |
| `frontend/src/app/pages/scrapers/scrapers-page.component.html` | NEW | ~80 | Two sections (cards + history) |
| `frontend/src/app/pages/scrapers/scrapers-page.component.css` | NEW | ~60 | Local styles |
| `frontend/src/app/pages/scrapers/scraper-card/scraper-card.component.ts` | NEW | ~70 | Card + Run button |
| `frontend/src/app/pages/scrapers/scraper-card/scraper-card.component.html` | NEW | ~30 | Template |
| `frontend/src/app/pages/scrapers/scraper-card/scraper-card.component.css` | NEW | ~30 | Styles |
| `frontend/src/app/pages/scrapers/run-history-list/run-history-list.component.ts` | NEW | ~70 | State badges |
| `frontend/src/app/pages/scrapers/run-history-list/run-history-list.component.html` | NEW | ~50 | Table |
| `frontend/src/app/pages/scrapers/run-history-list/run-history-list.component.css` | NEW | ~30 | Styles |
| `frontend/src/app/app.routes.ts` | MODIFIED | +6 / -0 | New lazy route |
| `frontend/src/app/app.html` | MODIFIED | +10 / -0 | Sidebar entry |
| `frontend/src/app/pages/products/products.component.ts` | MODIFIED | +50 / -5 | Filter signals + queryParamMap |
| `frontend/src/app/pages/products/products.component.html` | MODIFIED | +25 / -5 | Two `<select>` controls |
| `frontend/src/app/services/api.service.ts` | MODIFIED | +10 / -2 | Two optional params on `getProducts` |
| `packages/contracts/src/products/product-query.dto.ts` | MODIFIED | +15 / -0 | Add `source`/`type` filter fields |

**Total est. new lines:** ~1 050 · **Modified lines:** ~150 · **Number of files touched:** ~24 (well below the 400-line PR budget when split per-concern: contracts PR, backend PR, frontend PR).

---

## 8. Quality / NFR Targets

- **Latency:** scrapeOne returns ≤ 100 ms after insert (DB roundtrip only). `runs` ≤ 200 ms for 50 rows (spec §etl-run-history-logs §4 NFR).
- **Bandwidth:** poll response ≈ 2–5 KB at 50 rows; cadence 5 000 ms = ~0.5–1 KB/s sustained.
- **Index usage:** `etlRun @@index([status, startedAt(sort: Desc)])` already in schema covers both the WHERE+ORDER-BY and the per-source filtered case.
- **A11y:** native `<select>` for both products filters (spec §3.4 of products-unified-filtering). State badges use `aria-live="polite"` region.

---

## 9. Open Questions for `sdd-tasks` / Apply

1. The spec references `category` (Product Type) for the products filter. The current `public.Product` table stores this only inside `rawData Json?`. The apply phase should confirm the backend's `GET /api/products` endpoint enumerates over `EtlProduct` (where `category` is implicitly derivable from `rawJson.categoria` for the `aliexpress` source) or whether to add a denormalized `category` column — flagged as a possible follow-up migration.
2. Confirm the auth interceptor's behavior on 401 during polling: it currently re-throws, which would tear down the timer via `takeUntilDestroyed` only if the page is destroyed — but `tap` swallows the error. The polling effect already catches errors per spec §4.NFR; explicit confirmation needed during apply.
3. The `error` vs `errorSummary` Prisma field name mismatch is purely an internal mapping concern — confirmed design uses `errorSummary` from the DB and exposes it as `error` on the wire, as documented in §2.4.

---

## 10. Out-of-Scope / Follow-Up Migrations

- Add `QUEUED` to `EtlRunStatus` enum + a background dispatcher (BullMQ / RabbitMQ via existing infra) to honor spec §3.4 literal `queued` state. Tracked separately.
- DB advisory lock or Redis lock for true multi-instance serialization of scrapers (current design tolerates the rare double-fire; products are protected by `EtlProduct.@@unique([source, sourceId])`).
- Add a `category` denormalized column on `EtlProduct` (or a computed view) to make the products-page `type` filter index-friendly.
