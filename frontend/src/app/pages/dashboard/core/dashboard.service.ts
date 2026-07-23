import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, retry, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  AllKpis,
  CategoryDistributionRow,
  EncuestaRow,
  OutlierRow,
  PercentileRow,
  PreguntaPrincipalRow,
  RankedProductRow,
  Summary,
  TimeSeriesResponse,
} from './dashboard.types';

/**
 * One-line cache TTL for the high-traffic KPIs endpoint. We re-use
 * `shareReplay({ bufferSize: 1, refCount: true, windowTime })` so a
 * second subscriber within `CACHE_TTL_MS` reuses the previous
 * payload. `refCount: true` lets the source re-subscribe once all
 * subscribers unsubscribe and the window expires — with `false` the
 * source never re-fires after the cache evicts, so the dashboard
 * would show no summary data past the first `CACHE_TTL_MS`.
 */
const CACHE_TTL_MS = 60_000;

/**
 * DashboardService — read-only surface against the analytics API.
 *
 * Every method returns an `Observable<T>` typed against the DTOs in
 * `@web-scraping/contracts/analytics`. Components consume them with
 * the Angular `httpResource` or `toSignal` idioms; no manual
 * subscription is required from the call-site.
 *
 * Resilience:
 *   - `retry({ count: 1, delay: 500 })` retries once after 500 ms on
 *     a transient failure (network blip, transient 502 from the
 *     Render free-tier wake-up).
 *   - `catchError` keeps the observable chain alive so subscribers
 *     do not blow up with `NG0900`; it logs the error to the
 *     console (the global errorInterceptor already surfaces a
 *     toast) and returns `null` for non-critical reads, `throwError`
 *     for explicit-failure paths where the page cannot recover
 *     without the data.
 *
 * Caching:
 *   - Only the summary endpoint is cached (`shareReplay`) because
 *     it is called by every dashboard page; the others are cheap
 *     enough that caching buys little.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ─── KPIs ──────────────────────────────────────────────────

  /** Aggregated KPI envelope (5 views in one round-trip). */
  getAllKpis(): Observable<AllKpis> {
    return this.http.get<AllKpis>(`${this.base}/analytics/kpis`).pipe(
      retry<AllKpis>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) => this.handleError('getAllKpis', err)),
    );
  }

  /**
   * DW summary with snapshot banner — cached for 60 s because every
   * page of the dashboard reads it to render the snapshot warning.
   */
  getSummary(): Observable<Summary | null> {
    return this.http.get<Summary>(`${this.base}/analytics/summary`).pipe(
      retry<Summary>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) => this.handleSoftError<Summary>('getSummary', err)),
      shareReplay({ bufferSize: 1, refCount: true, windowTime: CACHE_TTL_MS }),
    );
  }

  // ─── Analytical queries ───────────────────────────────────

  getPreguntaPrincipal(): Observable<PreguntaPrincipalRow[] | null> {
    return this.http.get<PreguntaPrincipalRow[]>(`${this.base}/analytics/queries/main`).pipe(
      retry<PreguntaPrincipalRow[]>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) =>
        this.handleSoftError<PreguntaPrincipalRow[]>('getPreguntaPrincipal', err),
      ),
    );
  }

  getRankedProducts(): Observable<RankedProductRow[] | null> {
    return this.http.get<RankedProductRow[]>(`${this.base}/analytics/queries/ranked-products`).pipe(
      retry<RankedProductRow[]>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) =>
        this.handleSoftError<RankedProductRow[]>('getRankedProducts', err),
      ),
    );
  }

  getCategoryDistribution(): Observable<CategoryDistributionRow[] | null> {
    return this.http
      .get<CategoryDistributionRow[]>(`${this.base}/analytics/queries/category-distribution`)
      .pipe(
        retry<CategoryDistributionRow[]>({ count: 1, delay: 500 }),
        catchError((err: HttpErrorResponse) =>
          this.handleSoftError<CategoryDistributionRow[]>('getCategoryDistribution', err),
        ),
      );
  }

  getPercentiles(): Observable<PercentileRow[] | null> {
    return this.http.get<PercentileRow[]>(`${this.base}/analytics/queries/percentiles`).pipe(
      retry<PercentileRow[]>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) =>
        this.handleSoftError<PercentileRow[]>('getPercentiles', err),
      ),
    );
  }

  getOutliers(): Observable<OutlierRow[] | null> {
    return this.http.get<OutlierRow[]>(`${this.base}/analytics/queries/outliers`).pipe(
      retry<OutlierRow[]>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) =>
        this.handleSoftError<OutlierRow[]>('getOutliers', err),
      ),
    );
  }

  getEncuesta(): Observable<EncuestaRow[] | null> {
    return this.http.get<EncuestaRow[]>(`${this.base}/analytics/queries/encuesta`).pipe(
      retry<EncuestaRow[]>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) =>
        this.handleSoftError<EncuestaRow[]>('getEncuesta', err),
      ),
    );
  }

  getTimeSeries(): Observable<TimeSeriesResponse | null> {
    return this.http.get<TimeSeriesResponse>(`${this.base}/analytics/queries/time-series`).pipe(
      retry<TimeSeriesResponse>({ count: 1, delay: 500 }),
      catchError((err: HttpErrorResponse) =>
        this.handleSoftError<TimeSeriesResponse>('getTimeSeries', err),
      ),
    );
  }

  // ─── Error helpers ─────────────────────────────────────────

  /**
   * Hard error: re-throws so the page can branch on the failure and
   * render its own error UI (used by `getAllKpis` because the
   * resumen page cannot render ANY card without it).
   */
  private handleError(op: string, err: HttpErrorResponse): Observable<never> {
    console.error(`[DashboardService.${op}]`, err);
    return throwError(() => err);
  }

  /**
   * Soft error: returns `null` so the page renders a "data not
   * available" state instead of crashing. The page can still call
   * other endpoints successfully.
   */
  private handleSoftError<T>(op: string, err: HttpErrorResponse): Observable<T | null> {
    console.warn(`[DashboardService.${op}] returning null`, err);
    return of(null as T | null);
  }
}
