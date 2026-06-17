# Spec — Scraping Scheduler

## 1. Objective

Provide a basic scheduled scraping mechanism so domain rules can be scraped automatically at configurable intervals without manual triggering.

## 2. Scope

**In:** Backend cron-based scheduler, schedule entity, CRUD endpoints, integration with enqueueJob.

**Out:** Distributed cron (single-instance only), calendar UI, pause/resume individual schedules, notification thresholds.

## 3. Functional Requirements

### 3.1. Schedule Entity
A `ScrapingSchedule` model MUST be added to Prisma with at least:
- `id` (UUID)
- `domainRuleId` (FK → DomainRule)
- `cronExpression` (string — standard cron syntax, e.g. `"0 */6 * * *"` for every 6 hours)
- `enabled` (boolean, default `true`)
- `lastRunAt` (DateTime, nullable)
- `createdAt`, `updatedAt`

### 3.2. Scheduler Service
- The backend MUST use `@nestjs/schedule` (or equivalent `node-cron`) to evaluate schedules.
- On every cron tick, the service MUST query all `ScrapingSchedule` records where `enabled = true`.
- For each matching schedule, the service MUST call `ScrapingJobsService.enqueueJob(domainRuleId)`.
- The service MUST update `lastRunAt` after enqueuing.
- The scheduler SHOULD be implemented as a NestJS `@Injectable()` service with `@Cron()` decorators or a programmatic interval that checks cron expressions every minute.

### 3.3. CRUD Endpoints
The backend MUST expose REST endpoints under `/api/schedules`:
- `POST /api/schedules` — Create a new schedule (body: `domainRuleId`, `cronExpression`, `enabled?`).
- `GET /api/schedules` — List all schedules (include domain rule name).
- `GET /api/schedules/:id` — Get single schedule.
- `PATCH /api/schedules/:id` — Update cron expression or enabled status.
- `DELETE /api/schedules/:id` — Remove a schedule.

### 3.4. Sample URL Scraping
- When a schedule fires, if `DomainRule.sampleUrl` is set, the scheduler SHOULD enqueue that URL for scraping.
- If `sampleUrl` is null, the scheduler MAY enqueue the domain's base URL (the worker will determine what to scrape).

## 4. Non-Functional Requirements
- The scheduler MUST NOT prevent the backend from starting if no schedules exist.
- Cron evaluation MUST tolerate invalid expressions by logging a warning and skipping that schedule.

## 5. Scenarios

### 5.1. Create and activate a schedule
**Given** an existing DomainRule  
**When** I POST `{ domainRuleId: "<id>", cronExpression: "0 */6 * * *" }`  
**Then** a new ScrapingSchedule is created  
**And** jobs are enqueued every 6 hours

### 5.2. Disable a schedule
**Given** an active ScrapingSchedule  
**When** I PATCH `/api/schedules/:id` with `{ enabled: false }`  
**Then** the schedule is disabled  
**And** no new jobs are enqueued from it

### 5.3. Invalid cron expression
**Given** a ScrapingSchedule with an invalid cron expression  
**When** the scheduler evaluates it  
**Then** a warning is logged  
**And** the schedule is skipped
