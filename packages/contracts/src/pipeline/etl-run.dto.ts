/**
 * ETL Run DTOs — shared between the NestJS backend and Angular frontend.
 *
 * These types define the wire contract for the ETL management dashboard's
 * REST and SSE endpoints. They live in @web-scraping/contracts/pipeline so
 * both sides stay in sync without duplicating type definitions.
 *
 * Design decisions (from etl-management-dashboard-auth design.md):
 *   - `EtlRunDto.durationMs` is computed server-side from startedAt /
 *     finishedAt so the frontend doesn't need to calculate it.
 *   - `EtlRunListResponseDto` uses a standard pagination envelope with
 *     `data` and `meta` shapes matching the backend controller.
 *   - `TriggerEtlRequestDto` is empty (the trigger always runs a full
 *     'all' batch) but exists as a DTO for future extensibility.
 */

/** Mirror of the Prisma EtlRunStatus enum. */
export type EtlRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

/** Single ETL run visible to the management dashboard. */
export interface EtlRunDto {
  id: string;
  source: string;
  status: EtlRunStatus;
  startedAt: string;
  finishedAt: string | null;
  rowsScraped: number;
  rowsPersisted: number;
  /** Computed as finishedAt - startedAt in ms, or null while running. */
  durationMs: number | null;
  errorSummary: string | null;
}

/** Paginated response for GET /pipeline/etl-runs. */
export interface EtlRunListResponseDto {
  data: EtlRunDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Filters accepted by GET /pipeline/etl-runs. */
export interface EtlRunFiltersDto {
  status?: EtlRunStatus;
  source?: string;
  from?: string;
  to?: string;
}

/** Body for POST /pipeline/etl-runs/trigger. Currently empty. */
export interface TriggerEtlRequestDto {
  // Reserved for future use (e.g. selective source triggers)
}

/** Response for POST /pipeline/etl-runs/trigger. */
export interface TriggerEtlResponseDto {
  runId: string;
  status: EtlRunStatus;
}
