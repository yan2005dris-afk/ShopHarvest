import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, retry, catchError, shareReplay, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  Summary,
  AllKpis,
  PreguntaPrincipalRow,
  OutlierRow,
  TimeSeriesRow,
  EncuestaRow,
  TimeSeriesResponse,
} from './dashboard.types';

/** Shape of the global filter state for the entire dashboard. */
export interface DashboardFiltros {
  /** Selected source codes (empty = all). */
  fuentes: string[];
  /** Selected category names (empty = all). */
  categorias: string[];
  /** [min, max] price range in USD. */
  rangoPrecio: [number, number];
  /** Only show products with availability flag. */
  soloConDisponibilidad: boolean;
  /** Only show products with a rating. */
  soloConCalificacion: boolean;
  /** Optional start date filter (ISO string). */
  fechaDesde: string | null;
  /** Optional end date filter (ISO string). */
  fechaHasta: string | null;
}

const DEFAULT_FILTROS: DashboardFiltros = {
  fuentes: [],
  categorias: [],
  rangoPrecio: [0, 1000],
  soloConDisponibilidad: false,
  soloConCalificacion: false,
  fechaDesde: null,
  fechaHasta: null,
};

const CACHE_TTL_MS = 60_000;

/**
 * Centralized reactive store for the BI Dashboard.
 *
 * - Holds all data signals (summary, KPIs, analytical query results).
 * - Exposes a single `filtros` signal that drives derived computations.
 * - Provides pre-computed `filteredXxx` signals so pages/components stay thin.
 * - Handles coordinated data loading with caching (`shareReplay`).
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ─── Raw data signals ────────────────────────────────────────

  readonly summary = signal<Summary | null>(null);
  readonly kpis = signal<AllKpis | null>(null);
  readonly preguntaPrincipal = signal<PreguntaPrincipalRow[]>([]);
  readonly outliers = signal<OutlierRow[]>([]);
  readonly timeSeries = signal<TimeSeriesRow[]>([]);
  readonly encuesta = signal<EncuestaRow[]>([]);

  // ─── Loading / error state ──────────────────────────────────

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ─── Global filters (single source of truth) ─────────────────

  readonly filtros = signal<DashboardFiltros>(DEFAULT_FILTROS);

  /** Reset filters to defaults. */
  resetFilters(): void {
    this.filtros.set(DEFAULT_FILTROS);
  }

  /** Toggle a single source in/out of the selection. */
  toggleFuente(fuente: string): void {
    this.filtros.update((f) => ({
      ...f,
      fuentes: f.fuentes.includes(fuente)
        ? f.fuentes.filter((v) => v !== fuente)
        : [...f.fuentes, fuente],
    }));
  }

  /** Toggle a single category in/out of the selection. */
  toggleCategoria(categoria: string): void {
    this.filtros.update((f) => ({
      ...f,
      categorias: f.categorias.includes(categoria)
        ? f.categorias.filter((v) => v !== categoria)
        : [...f.categorias, categoria],
    }));
  }

  /** Set price range [min, max]. */
  setRangoPrecio(min: number, max: number): void {
    this.filtros.update((f) => ({ ...f, rangoPrecio: [min, max] }));
  }

  /** Set availability filter. */
  setSoloConDisponibilidad(v: boolean): void {
    this.filtros.update((f) => ({ ...f, soloConDisponibilidad: v }));
  }

  /** Set rating filter. */
  setSoloConCalificacion(v: boolean): void {
    this.filtros.update((f) => ({ ...f, soloConCalificacion: v }));
  }

  /** Set date range (ISO strings or null). */
  setFechaRange(desde: string | null, hasta: string | null): void {
    this.filtros.update((f) => ({ ...f, fechaDesde: desde, fechaHasta: hasta }));
  }

  // ─── Derived / filtered signals (pages consume THESE) ─────────

  /** Distinct source codes present in any loaded dataset. */
  readonly availableFuentes = computed<string[]>(() => {
    const sets = [
      this.preguntaPrincipal().map((r) => r.fuente),
      this.outliers().map((r) => r.fuente),
      this.timeSeries().map((r) => r.fuente),
      this.encuesta().map((r) => r.sitio_preferido),
    ];
    return Array.from(new Set(sets.flat())).sort();
  });

  /** Distinct categories present in pregunta-principal. */
  readonly availableCategorias = computed<string[]>(() => {
    const cats = this.preguntaPrincipal().map((r) => r.categoria);
    return Array.from(new Set(cats)).sort();
  });

  /** Pregunta principal rows after applying global filters. */
  readonly filteredPreguntaPrincipal = computed<PreguntaPrincipalRow[]>(() => {
    const rows = this.preguntaPrincipal();
    const { fuentes, categorias, rangoPrecio } = this.filtros();
    const [min, max] = rangoPrecio;
    const fuSet = new Set(fuentes);
    const catSet = new Set(categorias);

    return rows.filter((r) => {
      if (fuSet.size && !fuSet.has(r.fuente)) return false;
      if (catSet.size && !catSet.has(r.categoria)) return false;
      if (r.precio_promedio_usd < min || r.precio_promedio_usd > max) return false;
      return true;
    });
  });

  /** Outlier rows after applying global filters. */
  readonly filteredOutliers = computed<OutlierRow[]>(() => {
    const rows = this.outliers();
    const { fuentes, rangoPrecio } = this.filtros();
    const [min, max] = rangoPrecio;
    const fuSet = new Set(fuentes);

    return rows.filter((r) => {
      if (fuSet.size && !fuSet.has(r.fuente)) return false;
      if (r.precio_usd < min || r.precio_usd > max) return false;
      return true;
    });
  });

  /**
   * Time-series rows after applying global filters, including the
   * `fechaDesde` / `fechaHasta` range.
   *
   * The time-series is the ONLY chart with a real time dimension
   * (anio + trimestre per row). The other charts (pregunta principal,
   * outliers) aggregate over the whole DW snapshot and have no date
   * column exposed in their DTOs, so the date filter only narrows the
   * line chart. When the DW is in snapshot mode (one distinct date)
   * the filter is a no-op — see `timeRangeIsApplicable`.
   */
  readonly filteredTimeSeries = computed<TimeSeriesRow[]>(() => {
    const rows = this.timeSeries();
    const { fuentes, fechaDesde, fechaHasta } = this.filtros();
    const fuSet = new Set(fuentes);
    const fromTs = fechaDesde ? Date.parse(fechaDesde) : null;
    const toTs = fechaHasta ? Date.parse(fechaHasta) : null;

    return rows.filter((r) => {
      if (fuSet.size && !fuSet.has(r.fuente)) return false;
      // Each (anio, trimestre) maps to the FIRST day of that quarter for
      // range comparison. Good enough for an axis label; the dashboard
      // documents the limitation in the filter help-text.
      const rowTs = new Date(r.anio, (r.trimestre - 1) * 3, 1).getTime();
      if (fromTs !== null && rowTs < fromTs) return false;
      if (toTs !== null) {
        // inclusive end-of-quarter: add 3 months minus 1 day
        const endOfQuarter = new Date(r.anio, r.trimestre * 3, 0).getTime();
        if (endOfQuarter < toTs) return false;
      }
      return true;
    });
  });

  /**
   * True when the date-range filter has a chance of narrowing the
   * time-series chart. False when the DW is a single-day snapshot —
   * the UI disables the date pickers in that case and shows a
   * help-text explaining why.
   */
  readonly timeRangeIsApplicable = computed<boolean>(() => {
    const snap = this.summary()?.snapshot;
    return !!snap && snap.fechas_distintas > 1;
  });

  /** Min/max dates available in the DW (for datepicker bounds). */
  readonly timeRangeBounds = computed<{ min: string | null; max: string | null }>(() => {
    const snap = this.summary()?.snapshot;
    return {
      min: snap?.fecha_min ?? null,
      max: snap?.fecha_max ?? null,
    };
  });

  /** Encuesta rows after applying global filters (only fuente mapped to sitio_preferido). */
  readonly filteredEncuesta = computed<EncuestaRow[]>(() => {
    const rows = this.encuesta();
    const { fuentes } = this.filtros();
    const fuSet = new Set(fuentes);
    return rows.filter((r) => !fuSet.size || fuSet.has(r.sitio_preferido));
  });

  // ─── Chart-ready derived series (computed once, reused everywhere) ───────

  /** Ordered quarter keys (e.g. ["2024-Q1", "2024-Q2", ...]) from filtered time-series. */
  readonly timeSeriesQuarterKeys = computed<string[]>(() => {
    const rows = this.filteredTimeSeries();
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const r of rows) {
      const key = `${r.anio}-Q${r.trimestre}`;
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
    return keys;
  });

  /** Series for grouped bar chart: [{name: fuente, data: [precio por categoria...]}]. */
  readonly groupedBarSeries = computed<any[]>(() => {
    const rows = this.filteredPreguntaPrincipal();
    const categorias = Array.from(new Set(rows.map((r) => r.categoria))).sort();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    return fuentes.map((fuente) => ({
      name: fuente,
      data: categorias.map(
        (cat) =>
          rows.find((r) => r.fuente === fuente && r.categoria === cat)?.precio_promedio_usd ??
          0,
      ),
    }));
  });

  /** X-axis categories for grouped bar chart. */
  readonly groupedBarCategories = computed<string[]>(() => {
    const rows = this.filteredPreguntaPrincipal();
    return Array.from(new Set(rows.map((r) => r.categoria))).sort();
  });

  /** Series for line chart: [{name: fuente, data: [precio por trimestre...]}]. */
  readonly timeSeriesLineSeries = computed<any[]>(() => {
    const rows = this.filteredTimeSeries();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    const keys = this.timeSeriesQuarterKeys();
    return fuentes.map((fuente) => ({
      name: fuente,
      data: keys.map((key) => {
        const row = rows.find(
          (r) => r.fuente === fuente && `${r.anio}-Q${r.trimestre}` === key,
        );
        return row ? row.precio_promedio : null;
      }),
    }));
  });

  /** X-axis categories for line chart (formatted "Q{n} {anio}"). */
  readonly timeSeriesLineCategories = computed<string[]>(() => {
    const rows = this.filteredTimeSeries();
    const keys = this.timeSeriesQuarterKeys();
    const labelMap = new Map<string, string>();
    for (const r of rows) {
      const key = `${r.anio}-Q${r.trimestre}`;
      if (!labelMap.has(key)) labelMap.set(key, `Q${r.trimestre} ${r.anio}`);
    }
    return keys.map((key) => labelMap.get(key)!);
  });

  /** Scatter series: [{name: clasificacion, data: [{x: index, y: precio}]}]. */
  readonly scatterSeries = computed<any[]>(() => {
    const rows = this.filteredOutliers();
    const groups = new Map<string, { x: number; y: number }[]>();
    rows.forEach((r, i) => {
      const key = r.clasificacion ?? 'NORMAL';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ x: i, y: r.precio_usd });
    });
    return Array.from(groups.entries()).map(([name, data]) => ({ name, data }));
  });

  /** BoxPlot series: [{data: [{x: fuente, y: [min, q1, median, q3, max]}]}]. */
  readonly boxPlotSeries = computed<any[]>(() => {
    const rows = this.filteredOutliers();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();

    function fiveNumberSummary(arr: number[]): [number, number, number, number, number] {
      const sorted = [...arr].sort((a, b) => a - b);
      const q = (q: number) => {
        const pos = (sorted.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        return sorted[base + 1] !== undefined
          ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
          : sorted[base];
      };
      return [sorted[0], q(0.25), q(0.5), q(0.75), sorted[sorted.length - 1]];
    }

    const data = fuentes.map((fuente) => {
      const precios = rows.filter((r) => r.fuente === fuente).map((r) => r.precio_usd);
      return {
        x: fuente,
        y: precios.length ? fiveNumberSummary(precios) : [0, 0, 0, 0, 0],
      };
    });
    return [{ data }];
  });

  /** BoxPlot X-axis categories (fuentes). */
  readonly boxPlotCategories = computed<string[]>(() => {
    const rows = this.filteredOutliers();
    return Array.from(new Set(rows.map((r) => r.fuente))).sort();
  });

  /** Encuesta: grouped bar sitio × frecuencia. */
  readonly encuestaFreqSeries = computed<any[]>(() => {
    const rows = this.filteredEncuesta();
    const sitios = Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
    const freqs = Array.from(new Set(rows.map((r) => r.frecuencia))).sort();
    return freqs.map((freq) => ({
      name: freq,
      data: sitios.map(
        (sitio) => rows.filter((r) => r.sitio_preferido === sitio && r.frecuencia === freq).length,
      ),
    }));
  });

  /** Encuesta: X-axis categories (sitios). */
  readonly encuestaFreqCategories = computed<string[]>(() => {
    const rows = this.filteredEncuesta();
    return Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
  });

  /** Encuesta: heatmap series (single series with {x: gasto, y: count} per sitio). */
  readonly encuestaHeatmapSeries = computed<any[]>(() => {
    const rows = this.filteredEncuesta();
    const sitios = Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
    const gastos = Array.from(new Set(rows.map((r) => r.gasto_promedio))).sort();
    const data: { x: string; y: number }[] = [];
    for (const sitio of sitios) {
      for (const gasto of gastos) {
        data.push({
          x: gasto,
          y: rows.filter((r) => r.sitio_preferido === sitio && r.gasto_promedio === gasto).length,
        });
      }
    }
    const name = sitios.length === 1 ? sitios[0] : sitios.length === 0 ? 'Sin datos' : `${sitios.length} sitios`;
    return [{ name, data }];
  });

  /** Encuesta: heatmap X-axis (gasto buckets). */
  readonly encuestaHeatmapCategories = computed<string[]>(() => {
    const rows = this.filteredEncuesta();
    return Array.from(new Set(rows.map((r) => r.gasto_promedio))).sort();
  });

  /** Encuesta: pie chart series (counts per género). */
  readonly encuestaPieSeries = computed<number[]>(() => {
    const rows = this.filteredEncuesta();
    const generos = Array.from(new Set(rows.map((r) => r.genero))).sort();
    return generos.map((g) => rows.filter((r) => r.genero === g).length);
  });

  /** Encuesta: pie chart labels (géneros). */
  readonly encuestaPieLabels = computed<string[]>(() => {
    const rows = this.filteredEncuesta();
    return Array.from(new Set(rows.map((r) => r.genero))).sort();
  });

  // ─── Snapshot banner helpers ──────────────────────────────────

  /** True if DW has only one distinct date (snapshot mode). */
  readonly isSnapshot = computed<boolean>(() => {
    const s = this.summary();
    return s?.snapshot?.fechas_distintas === 1 && !!s.snapshot?.fecha_min;
  });

  /** Snapshot date string for banner. */
  readonly snapshotDate = computed<string>(() => this.summary()?.snapshot?.fecha_min ?? '');

  // ─── Data loading ─────────────────────────────────────────────

  /** Load all dashboard data in parallel. Safe to call multiple times. */
  async initialize(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      await Promise.all([
        this.loadSummary(),
        this.loadKpis(),
        this.loadPreguntaPrincipal(),
        this.loadOutliers(),
        this.loadTimeSeries(),
        this.loadEncuesta(),
      ]);
    } catch (e) {
      this.error.set((e as Error).message ?? 'Error cargando dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  // Individual loaders with caching (shareReplay)

  private async loadSummary(): Promise<void> {
    const s = await firstValueFrom(
      this.http
        .get<Summary>(`${this.base}/analytics/summary`)
        .pipe(
          retry({ count: 1, delay: 500 }),
          catchError(() => of(null)),
          shareReplay({ bufferSize: 1, refCount: true, windowTime: CACHE_TTL_MS }),
        )
    );
    this.summary.set(s);
  }

  private async loadKpis(): Promise<void> {
    const k = await firstValueFrom(
      this.http
        .get<AllKpis>(`${this.base}/analytics/kpis`)
        .pipe(
          retry({ count: 1, delay: 500 }),
          catchError(() => of(null)),
        )
    );
    this.kpis.set(k);
  }

  private async loadPreguntaPrincipal(): Promise<void> {
    const rows = await firstValueFrom(
      this.http
        .get<PreguntaPrincipalRow[]>(`${this.base}/analytics/queries/main`)
        .pipe(
          retry({ count: 1, delay: 500 }),
          catchError(() => of([])),
        )
    );
    this.preguntaPrincipal.set(rows ?? []);
  }

  private async loadOutliers(): Promise<void> {
    const rows = await firstValueFrom(
      this.http
        .get<OutlierRow[]>(`${this.base}/analytics/queries/outliers`)
        .pipe(
          retry({ count: 1, delay: 500 }),
          catchError(() => of([])),
        )
    );
    this.outliers.set(rows ?? []);
  }

  private async loadTimeSeries(): Promise<void> {
    const resp = await firstValueFrom(
      this.http
        .get<TimeSeriesResponse>(`${this.base}/analytics/queries/time-series`)
        .pipe(
          retry({ count: 1, delay: 500 }),
          catchError(() =>
            of({
              series: [],
              snapshot: { fecha_min: null, fecha_max: null, fechas_distintas: 0 },
            } as TimeSeriesResponse),
          ),
        )
    );
    this.timeSeries.set(resp?.series ?? []);
  }

  private async loadEncuesta(): Promise<void> {
    const rows = await firstValueFrom(
      this.http
        .get<EncuestaRow[]>(`${this.base}/analytics/queries/encuesta`)
        .pipe(
          retry({ count: 1, delay: 500 }),
          catchError(() => of([])),
        )
    );
    this.encuesta.set(rows ?? []);
  }
}