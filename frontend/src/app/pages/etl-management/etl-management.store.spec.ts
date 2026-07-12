import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EtlManagementStore } from './etl-management.store';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close = vi.fn();

  emitMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  emitError() {
    if (this.onerror) {
      this.onerror();
    }
  }
}

describe('EtlManagementStore', () => {
  let store: EtlManagementStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    (globalThis as any).EventSource = MockEventSource;
    MockEventSource.instances = [];

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'test-token',
          },
        },
      ],
    });

    store = TestBed.inject(EtlManagementStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Flush any pending captures summary requests
    const pendingReqs = httpMock.match('/api/pipeline/pending-captures');
    pendingReqs.forEach(req => req.flush({ total: 0, sources: {} }));

    httpMock.verify();
    store.ngOnDestroy();
    vi.useRealTimers();
  });

  it('should load runs with filters and pagination', () => {
    // Set filters/page and flush initial requests triggered by the signals
    store.setFilters({ status: 'SUCCESS', source: 'mercadolibre' });
    const reqsFilter = httpMock.match(req => req.url === '/api/pipeline/etl-runs');
    reqsFilter.forEach(r => r.flush({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }));

    store.setPage(2);
    const reqsPage = httpMock.match(req => req.url === '/api/pipeline/etl-runs');
    reqsPage.forEach(r => r.flush({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } }));

    // Explicit loadRuns check
    store.loadRuns();
    const req = httpMock.expectOne(r => {
      return r.url === '/api/pipeline/etl-runs' && r.params.get('page') === '2';
    });
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('status')).toBe('SUCCESS');
    expect(req.request.params.get('source')).toBe('mercadolibre');

    req.flush({
      data: [{ id: '1', source: 'mercadolibre', status: 'SUCCESS', startedAt: '2026-07-12T00:00:00.000Z', finishedAt: null, rowsScraped: 10, rowsPersisted: 5, durationMs: null, errorSummary: null }],
      meta: { page: 2, limit: 20, total: 100, totalPages: 5 },
    });

    expect(store.runs()).toEqual([{ id: '1', source: 'mercadolibre', status: 'SUCCESS', startedAt: '2026-07-12T00:00:00.000Z', finishedAt: null, rowsScraped: 10, rowsPersisted: 5, durationMs: null, errorSummary: null }]);
    expect(store.meta()).toEqual({ page: 2, limit: 20, total: 100, totalPages: 5 });
    expect(store.loading()).toBe(false);
  });

  it('should trigger run, reload list, and start SSE stream', () => {
    store.triggerRun();

    const triggerReq = httpMock.expectOne('/api/pipeline/etl-runs/trigger');
    expect(triggerReq.request.method).toBe('POST');
    triggerReq.flush({ runId: 'new-run-id', status: 'RUNNING' });

    const detailReq = httpMock.expectOne('/api/pipeline/etl-runs/new-run-id');
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush({ id: 'new-run-id', source: 'all', status: 'RUNNING', startedAt: '2026-07-12T00:00:00.000Z', finishedAt: null, rowsScraped: 0, rowsPersisted: 0, durationMs: null, errorSummary: null });

    const listReq = httpMock.expectOne(r => r.url === '/api/pipeline/etl-runs');
    listReq.flush({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toContain('/api/pipeline/etl-runs/new-run-id/stream?token=test-token');
    expect(store.streamActive()).toBe(true);
  });

  it('should process progress and complete events in SSE stream', () => {
    store.selectRunId('run-123');

    const detailReq = httpMock.expectOne('/api/pipeline/etl-runs/run-123');
    detailReq.flush({ id: 'run-123', status: 'RUNNING', source: 'amazon', startedAt: '2026-07-12T00:00:00.000Z', finishedAt: null, rowsScraped: 0, rowsPersisted: 0, durationMs: null, errorSummary: null });

    expect(MockEventSource.instances.length).toBe(1);
    const sse = MockEventSource.instances[0];

    // Emit progress event
    sse.emitMessage({
      event: 'progress',
      id: 'run-123',
      source: 'amazon',
      status: 'RUNNING',
      startedAt: '2026-07-12T00:00:00.000Z',
      finishedAt: null,
      rowsScraped: 10,
      rowsPersisted: 5,
      durationMs: null,
      errorSummary: null,
    });

    expect(store.selectedRun()).toEqual({
      id: 'run-123',
      source: 'amazon',
      status: 'RUNNING',
      startedAt: '2026-07-12T00:00:00.000Z',
      finishedAt: null,
      rowsScraped: 10,
      rowsPersisted: 5,
      durationMs: null,
      errorSummary: null,
    });

    // Emit complete event
    sse.emitMessage({
      event: 'complete',
      id: 'run-123',
      source: 'amazon',
      status: 'SUCCESS',
      startedAt: '2026-07-12T00:00:00.000Z',
      finishedAt: '2026-07-12T00:05:00.000Z',
      rowsScraped: 20,
      rowsPersisted: 20,
      durationMs: 300000,
      errorSummary: null,
    });

    expect(sse.close).toHaveBeenCalled();
    expect(store.streamActive()).toBe(false);

    const listReq = httpMock.expectOne(r => r.url === '/api/pipeline/etl-runs');
    listReq.flush({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('should fallback to 5s polling when SSE error occurs', () => {
    vi.useFakeTimers();
    store.selectRunId('run-456');

    const detailReq = httpMock.expectOne('/api/pipeline/etl-runs/run-456');
    detailReq.flush({ id: 'run-456', status: 'RUNNING', source: 'ebay', startedAt: '2026-07-12T00:00:00.000Z', finishedAt: null, rowsScraped: 0, rowsPersisted: 0, durationMs: null, errorSummary: null });

    expect(MockEventSource.instances.length).toBe(1);
    const sse = MockEventSource.instances[0];

    // Trigger SSE error
    sse.emitError();

    // EventSource should be closed
    expect(sse.close).toHaveBeenCalled();

    // Move time forward by 5s to trigger polling fallback
    vi.advanceTimersByTime(5000);

    const pollReq = httpMock.expectOne('/api/pipeline/etl-runs/run-456');
    expect(pollReq.request.method).toBe('GET');
    pollReq.flush({ id: 'run-456', status: 'SUCCESS', source: 'ebay', startedAt: '2026-07-12T00:00:00.000Z', finishedAt: '2026-07-12T01:00:00.000Z', rowsScraped: 50, rowsPersisted: 50, durationMs: 3600000, errorSummary: null });

    // Once status is terminal (SUCCESS), polling stops and list is reloaded
    const listReq = httpMock.expectOne(r => r.url === '/api/pipeline/etl-runs');
    listReq.flush({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });
});
