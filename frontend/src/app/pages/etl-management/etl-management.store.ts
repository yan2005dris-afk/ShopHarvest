import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import type {
  EtlRunDto,
  EtlRunFiltersDto,
  EtlRunListResponseDto,
  TriggerEtlResponseDto,
  EtlRunStatus,
} from '@web-scraping/contracts/pipeline';

@Injectable({ providedIn: 'root' })
export class EtlManagementStore implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // ─── State Signals ─────────────────────────────────────────
  readonly runs = signal<EtlRunDto[]>([]);
  readonly meta = signal<EtlRunListResponseDto['meta'] | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly selectedRun = signal<EtlRunDto | null>(null);
  readonly streamActive = signal<boolean>(false);
  readonly pendingSummary = signal<any>(null);

  // Pagination & Filtering Signals
  readonly page = signal<number>(1);
  readonly limit = signal<number>(20);
  readonly filters = signal<EtlRunFiltersDto>({});

  // SSE/Polling handles
  private eventSource: EventSource | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {}

  /**
   * Backend errors are RFC 7807 envelopes (`detail`, not `message`) — see
   * `HttpExceptionFilter`. 403 gets a fixed friendly override instead of
   * Nest's generic "Forbidden resource" detail.
   */
  private describeError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 403) {
        return "You don't have permission to perform this action.";
      }
      const body = err.error as { detail?: string; message?: string | string[] } | null;
      const detail =
        body?.detail ?? (Array.isArray(body?.message) ? body.message.join('; ') : body?.message);
      if (detail) return detail;
    }
    return fallback;
  }

  // ─── Actions ────────────────────────────────────────────────
  clearError(): void {
    this.error.set(null);
  }

  loadPendingSummary(): void {
    this.http.get<any>('/api/pipeline/pending-captures').subscribe({
      next: (res) => {
        this.pendingSummary.set(res);
      },
      error: (err) => {
        console.error('Failed to load pending captures summary', err);
      },
    });
  }

  loadRuns(): void {
    this.loading.set(true);
    this.error.set(null);
    this.loadPendingSummary();

    let params = new HttpParams()
      .set('page', this.page().toString())
      .set('limit', this.limit().toString());

    const activeFilters = this.filters();
    if (activeFilters.status) {
      params = params.set('status', activeFilters.status);
    }
    if (activeFilters.source) {
      params = params.set('source', activeFilters.source);
    }
    if (activeFilters.from) {
      params = params.set('from', activeFilters.from);
    }
    if (activeFilters.to) {
      params = params.set('to', activeFilters.to);
    }

    this.http.get<EtlRunListResponseDto>('/api/pipeline/etl-runs', { params }).subscribe({
      next: (res) => {
        this.runs.set(res.data);
        this.meta.set(res.meta);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.describeError(err, 'Failed to load runs'));
        this.loading.set(false);
      },
    });
  }

  triggerRun(options?: { action: 'full' | 'local'; source: string }): void {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .post<TriggerEtlResponseDto>('/api/pipeline/etl-runs/trigger', options || {})
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.selectRunId(res.runId);
          this.loadRuns();
        },
        error: (err) => {
          this.error.set(this.describeError(err, 'Failed to trigger run'));
          this.loading.set(false);
        },
      });
  }

  selectRunId(runId: string): void {
    this.stopStreamAndPolling();
    this.http.get<EtlRunDto>(`/api/pipeline/etl-runs/${runId}`).subscribe({
      next: (run) => {
        this.selectedRun.set(run);
        if (run.status === 'RUNNING') {
          this.startSseStream(runId);
        }
      },
      error: (err) => {
        this.error.set(this.describeError(err, 'Failed to load run detail'));
      },
    });
  }

  selectRun(run: EtlRunDto | null): void {
    this.stopStreamAndPolling();
    this.selectedRun.set(run);
    if (run && run.status === 'RUNNING') {
      this.startSseStream(run.id);
    }
  }

  setPage(page: number): void {
    this.page.set(page);
    this.loadRuns();
  }

  setFilters(filters: EtlRunFiltersDto): void {
    this.filters.set(filters);
    this.page.set(1);
    this.loadRuns();
  }

  clearFilters(): void {
    this.filters.set({});
    this.page.set(1);
    this.loadRuns();
  }

  // ─── SSE and Polling Implementation ────────────────────────
  private startSseStream(runId: string): void {
    this.stopStreamAndPolling();
    this.streamActive.set(true);

    const token = this.authService.getAccessToken();
    const url = `/api/pipeline/etl-runs/${runId}/stream?token=${token || ''}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        this.resetHeartbeatCheck(runId);
        try {
          const payload = JSON.parse(event.data);

          if (payload.event === 'heartbeat') {
            return;
          }

          if (payload.event === 'error') {
            this.handleStreamError(runId, payload.message || 'Stream error event received');
            return;
          }

          // Map event data to EtlRunDto
          const run: EtlRunDto = {
            id: payload.id,
            source: payload.source,
            status: payload.status,
            startedAt: payload.startedAt,
            finishedAt: payload.finishedAt,
            rowsScraped: payload.rowsScraped,
            rowsPersisted: payload.rowsPersisted,
            durationMs: payload.durationMs,
            errorSummary: payload.errorSummary,
          };

          this.selectedRun.set(run);
          this.updateRunInList(run);

          if (payload.event === 'complete' || run.status === 'SUCCESS' || run.status === 'FAILED') {
            this.stopStreamAndPolling();
            this.loadRuns();
          }
        } catch (e) {
          this.handleStreamError(runId, 'Failed to parse stream data');
        }
      };

      this.eventSource.onerror = () => {
        this.handleStreamError(runId, 'EventSource connection error');
      };

      this.resetHeartbeatCheck(runId);
    } catch (err) {
      this.handleStreamError(runId, 'Failed to initialize EventSource');
    }
  }

  private handleStreamError(runId: string, reason: string): void {
    console.warn(`SSE error for run ${runId} (${reason}). Falling back to 5s polling.`);
    this.stopSseOnly();
    this.startPollingFallback(runId);
  }

  private startPollingFallback(runId: string): void {
    if (this.pollingIntervalId) return;

    this.pollingIntervalId = setInterval(() => {
      this.http.get<EtlRunDto>(`/api/pipeline/etl-runs/${runId}`).subscribe({
        next: (run) => {
          this.selectedRun.set(run);
          this.updateRunInList(run);

          if (run.status === 'SUCCESS' || run.status === 'FAILED') {
            this.stopStreamAndPolling();
            this.loadRuns();
          }
        },
        error: (err) => {
          console.error('Polling fallback failed', err);
        },
      });
    }, 5000);
  }

  private updateRunInList(run: EtlRunDto): void {
    const list = this.runs();
    const idx = list.findIndex((r) => r.id === run.id);
    if (idx !== -1) {
      const newList = [...list];
      newList[idx] = run;
      this.runs.set(newList);
    }
  }

  private stopSseOnly(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  private stopStreamAndPolling(): void {
    this.stopSseOnly();
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    this.streamActive.set(false);
  }

  private resetHeartbeatCheck(runId: string): void {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }
    // Heartbeat is sent every 15s. If we don't hear anything in 20s, fallback.
    this.heartbeatTimeoutId = setTimeout(() => {
      this.handleStreamError(runId, 'Heartbeat timeout');
    }, 20000);
  }

  ngOnDestroy(): void {
    this.stopStreamAndPolling();
  }
}
