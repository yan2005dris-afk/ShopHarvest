import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexXAxis,
} from 'ng-apexcharts';
import { DashboardService } from '../../core/dashboard.service';
import { KpiFiltersService } from '../../core/kpi-filters.service';
import type {
  OutlierRow,
  PreguntaPrincipalRow,
  Summary,
  TimeSeriesRow,
} from '../../core/dashboard.types';
import { ChartHostComponent } from '../../shared/chart-host/chart-host.component';

/** Linear-interpolation quantile over a pre-sorted numeric array. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/** ApexCharts boxPlot five-number summary: [min, Q1, median, Q3, max]. */
function fiveNumberSummary(precios: number[]): [number, number, number, number, number] {
  const sorted = [...precios].sort((a, b) => a - b);
  return [
    sorted[0],
    quantile(sorted, 0.25),
    quantile(sorted, 0.5),
    quantile(sorted, 0.75),
    sorted[sorted.length - 1],
  ];
}

/**
 * Analisis page — 3 chart families + reactive filter sidebar.
 *
 * Family 1: grouped bar of AVG(precio_usd) by fuente × categoria
 *           (driven by `getPreguntaPrincipal`).
 * Family 2: line chart of precio promedio por trimestre × fuente with
 *           a prominent "snapshot de UN SOLO DÍA" banner.
 * Family 3: scatter + boxPlot using `getOutliers`.
 *
 * The filter inputs drive a `computed()` derivation that recomputes
 * every chart's series array whenever any filter changes. Because the
 * underlying data is small (168 products / 24 surveys) we filter
 * client-side rather than re-hitting the backend — this keeps the
 * UI snappy and avoids the round-trip latency that would dominate
 * over the actual render time.
 */
@Component({
  selector: 'app-analisis-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ChartHostComponent],
  template: `
    <header class="page-header">
      <h1>Análisis de precios</h1>
      <p class="page-sub">
        3 familias de gráficos con filtros reactivos. Cambiá un filtro y los
        gráficos se recalculan automáticamente.
      </p>
    </header>

    @if (showSnapshotBanner()) {
      <div class="snapshot-banner" role="status">
        <span class="snapshot-banner__icon" aria-hidden="true">⚠️</span>
        <span>
          Serie temporal con <strong>UN SOLO DÍA</strong> de datos
          ({{ snapshotDate() }}). La línea es representativa del snapshot, no de
          una tendencia temporal real.
        </span>
      </div>
    }

    <div class="analisis-layout">
      <aside class="filter-sidebar" aria-label="Filtros globales">
        <h3>Filtros</h3>

        <fieldset class="filter-group">
          <legend>Fuentes</legend>
          @for (f of availableFuentes(); track f) {
            <label class="filter-check">
              <input
                type="checkbox"
                [checked]="isFuenteSelected(f)"
                (change)="toggleFuente(f)"
              />
              <span>{{ f }}</span>
            </label>
          }
        </fieldset>

        <fieldset class="filter-group">
          <legend>Categorías</legend>
          @if (availableCategorias().length === 0) {
            <p class="filter-empty">Cargando categorías…</p>
          }
          @for (c of availableCategorias(); track c) {
            <label class="filter-check">
              <input
                type="checkbox"
                [checked]="isCategoriaSelected(c)"
                (change)="toggleCategoria(c)"
              />
              <span>{{ c }}</span>
            </label>
          }
        </fieldset>

        <fieldset class="filter-group">
          <legend>Rango de precio (USD)</legend>
          <div class="range-row">
            <input
              type="number"
              min="0"
              step="1"
              [ngModel]="rangoMin()"
              (ngModelChange)="setRangoMin($event)"
              aria-label="Precio mínimo"
            />
            <span>—</span>
            <input
              type="number"
              min="0"
              step="1"
              [ngModel]="rangoMax()"
              (ngModelChange)="setRangoMax($event)"
              aria-label="Precio máximo"
            />
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Restricciones</legend>
          <label class="filter-check">
            <input
              type="checkbox"
              [ngModel]="filters.soloConDisponibilidad()"
              (ngModelChange)="filters.soloConDisponibilidad.set($event)"
            />
            <span>Solo con disponibilidad</span>
          </label>
          <label class="filter-check">
            <input
              type="checkbox"
              [ngModel]="filters.soloConCalificacion()"
              (ngModelChange)="filters.soloConCalificacion.set($event)"
            />
            <span>Solo con calificación</span>
          </label>
        </fieldset>

        <button type="button" class="reset-btn" (click)="filters.reset()">
          Limpiar filtros
        </button>
      </aside>

      <section class="charts">
        <article class="chart-card">
          <header class="chart-card__header">
            <h2>1 · Barras correlacionales</h2>
            <p>Precio promedio por fuente × categoría</p>
          </header>
          <app-chart-host
            [type]="'bar'"
            [series]="mainSeries()"
            [xaxis]="mainXaxis()"
            [colors]="palette"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <h2>2 · Serie temporal</h2>
            <p>Precio promedio por trimestre (snapshot)</p>
          </header>
          <app-chart-host
            [type]="'line'"
            [series]="timeSeriesSeries()"
            [xaxis]="timeSeriesXaxis()"
            [colors]="palette"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <h2>3 · Dispersión de outliers (IQR)</h2>
            <p>Precio por producto coloreado por clasificación</p>
          </header>
          <app-chart-host
            [type]="'scatter'"
            [series]="outlierSeries()"
            [xaxis]="outlierXaxis()"
            [colors]="['#10b981', '#ef4444', '#f59e0b']"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <h2>4 · Box plot por fuente</h2>
            <p>Distribución del rango de precios detectado como outlier</p>
          </header>
          <app-chart-host
            [type]="'boxPlot'"
            [series]="boxPlotSeries()"
            [xaxis]="boxPlotXaxis()"
            [colors]="palette"
          />
        </article>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-header h1 {
        margin: 0 0 0.25rem;
        font-size: 1.75rem;
        color: #111827;
      }
      .page-sub {
        margin: 0 0 1.5rem;
        color: #6b7280;
      }
      .snapshot-banner {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        font-size: 0.9rem;
      }
      .analisis-layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 1.5rem;
        align-items: start;
      }
      @media (max-width: 900px) {
        .analisis-layout {
          grid-template-columns: 1fr;
        }
      }
      .filter-sidebar {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        position: sticky;
        top: 1rem;
      }
      .filter-sidebar h3 {
        margin: 0;
        font-size: 1rem;
        color: #111827;
      }
      .filter-group {
        border: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .filter-group legend {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .filter-check {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: #374151;
      }
      .filter-empty {
        font-size: 0.8rem;
        color: #9ca3af;
        margin: 0;
      }
      .range-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .range-row input {
        width: 90px;
        padding: 0.25rem 0.4rem;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 0.85rem;
      }
      .reset-btn {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.85rem;
        cursor: pointer;
        color: #374151;
      }
      .reset-btn:hover {
        background: #e5e7eb;
      }
      .charts {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .chart-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.25rem;
      }
      .chart-card__header h2 {
        font-size: 1.1rem;
        margin: 0 0 0.25rem;
        color: #111827;
      }
      .chart-card__header p {
        font-size: 0.85rem;
        color: #6b7280;
        margin: 0 0 1rem;
      }
    `,
  ],
})
export class AnalisisPage {
  private readonly dashboardService = inject(DashboardService);
  readonly filters = inject(KpiFiltersService);

  /** Distinct palette to keep chart 1 / 2 / 4 visually consistent. */
  readonly palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // ─── Data signals ─────────────────────────────────────────

  readonly preguntaPrincipal = signal<PreguntaPrincipalRow[]>([]);
  readonly outliers = signal<OutlierRow[]>([]);
  readonly timeSeries = signal<TimeSeriesRow[]>([]);
  readonly summary = signal<Summary | null>(null);

  // ─── Filtered derivations ─────────────────────────────────

  /**
   * Apply the active fuente/categoria/price range filters to the
   * pregunta-principal rows. If `categoriaSeleccionada` is empty we
   * show all categories.
   */
  readonly filteredPreguntaPrincipal = computed<PreguntaPrincipalRow[]>(() => {
    const rows = this.preguntaPrincipal();
    const fuentes = new Set(this.filters.fuenteSeleccionada());
    const cats = new Set(this.filters.categoriaSeleccionada());
    const [min, max] = this.filters.rangoPrecio();
    return rows.filter((r) => {
      if (fuentes.size && !fuentes.has(r.fuente)) return false;
      if (cats.size && !cats.has(r.categoria)) return false;
      if (r.precio_promedio_usd < min || r.precio_promedio_usd > max) return false;
      return true;
    });
  });

  readonly filteredOutliers = computed<OutlierRow[]>(() => {
    const rows = this.outliers();
    const fuentes = new Set(this.filters.fuenteSeleccionada());
    const [min, max] = this.filters.rangoPrecio();
    return rows.filter((r) => {
      if (fuentes.size && !fuentes.has(r.fuente)) return false;
      if (r.precio_usd < min || r.precio_usd > max) return false;
      return true;
    });
  });

  readonly filteredTimeSeries = computed<TimeSeriesRow[]>(() => {
    const rows = this.timeSeries();
    const fuentes = new Set(this.filters.fuenteSeleccionada());
    return rows.filter((r) => !fuentes.size || fuentes.has(r.fuente));
  });

  // ─── Chart 1: Grouped bar (fuente × categoria) ─────────────

  readonly mainSeries = computed<any[]>(() => {
    const rows = this.filteredPreguntaPrincipal();
    const categorias = Array.from(new Set(rows.map((r) => r.categoria))).sort();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    return fuentes.map((fuente) => ({
      name: fuente,
      data: categorias.map(
        (cat) =>
          rows.find((r) => r.fuente === fuente && r.categoria === cat)?.precio_promedio_usd ?? 0,
      ),
    }));
  });

  readonly mainXaxis = computed<any>(() => {
    const rows = this.filteredPreguntaPrincipal();
    const categorias = Array.from(new Set(rows.map((r) => r.categoria))).sort();
    return { categories: categorias };
  });

  // ─── Chart 2: Line (trimestre × fuente) ───────────────────

  /**
   * Ordered (anio, trimestre) quarter keys, deduped in first-seen
   * order. `timeSeriesSeries` and `timeSeriesXaxis` both iterate this
   * exact array so a fuente missing a quarter gets `null` at that
   * position instead of shifting its later points onto the wrong
   * x-axis label (CodeRabbit finding, PR #11).
   */
  private readonly timeSeriesQuarterKeys = computed<string[]>(() => {
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

  readonly timeSeriesSeries = computed<any[]>(() => {
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

  readonly timeSeriesXaxis = computed<any>(() => {
    const rows = this.filteredTimeSeries();
    const keys = this.timeSeriesQuarterKeys();
    const labels = new Map<string, string>();
    for (const r of rows) {
      const key = `${r.anio}-Q${r.trimestre}`;
      if (!labels.has(key)) labels.set(key, `Q${r.trimestre} ${r.anio}`);
    }
    return { categories: keys.map((key) => labels.get(key)!) };
  });

  // ─── Chart 3: Scatter (precio vs id_hecho) ─────────────────

  readonly outlierSeries = computed<any[]>(() => {
    const rows = this.filteredOutliers();
    const groups = new Map<string, { x: number; y: number }[]>();
    rows.forEach((r, i) => {
      const key = r.clasificacion || 'NORMAL';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ x: i, y: r.precio_usd });
    });
    return Array.from(groups.entries()).map(([name, data]) => ({ name, data }));
  });

  readonly outlierXaxis = computed<any>(() => ({
    type: 'numeric',
    title: { text: 'Producto (índice)' },
    labels: { rotate: 0 },
  }));

  // ─── Chart 4: BoxPlot por fuente ──────────────────────────

  readonly boxPlotSeries = computed<any[]>(() => {
    const rows = this.filteredOutliers();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    const data = fuentes.map((fuente) => {
      const precios = rows.filter((r) => r.fuente === fuente).map((r) => r.precio_usd);
      return {
        x: fuente,
        y: precios.length ? fiveNumberSummary(precios) : [0, 0, 0, 0, 0],
      };
    });
    // ApexCharts boxPlot expects series: [{ data: [{x,y}, ...] }] — a
    // flat array of points (the pre-fix shape here) is not a valid
    // series array.
    return [{ data }];
  });

  readonly boxPlotXaxis = computed<any>(() => ({
    type: 'category',
    categories: Array.from(
      new Set(this.filteredOutliers().map((r) => r.fuente)),
    ).sort(),
  }));

  // ─── Sidebar filter helpers ───────────────────────────────

  readonly availableFuentes = computed<string[]>(() => {
    const fromMain = this.preguntaPrincipal().map((r) => r.fuente);
    const fromOutliers = this.outliers().map((r) => r.fuente);
    const fromTs = this.timeSeries().map((r) => r.fuente);
    return Array.from(new Set([...fromMain, ...fromOutliers, ...fromTs])).sort();
  });

  readonly availableCategorias = computed<string[]>(() => {
    const fromMain = this.preguntaPrincipal().map((r) => r.categoria);
    return Array.from(new Set(fromMain)).sort();
  });

  readonly rangoMin = computed(() => this.filters.rangoPrecio()[0]);
  readonly rangoMax = computed(() => this.filters.rangoPrecio()[1]);

  isFuenteSelected(value: string): boolean {
    return this.filters.fuenteSeleccionada().includes(value);
  }
  isCategoriaSelected(value: string): boolean {
    return this.filters.categoriaSeleccionada().includes(value);
  }
  toggleFuente(value: string): void {
    this.filters.toggleFuente(value);
  }
  toggleCategoria(value: string): void {
    this.filters.toggleCategoria(value);
  }
  setRangoMin(value: number): void {
    const [, max] = this.filters.rangoPrecio();
    this.filters.rangoPrecio.set([Number(value) || 0, max]);
  }
  setRangoMax(value: number): void {
    const [min] = this.filters.rangoPrecio();
    this.filters.rangoPrecio.set([min, Number(value) || 0]);
  }

  // ─── Snapshot banner ──────────────────────────────────────

  readonly showSnapshotBanner = computed<boolean>(() => {
    const s = this.summary();
    if (!s) return false;
    return s.snapshot?.fechas_distintas === 1 && !!s.snapshot?.fecha_min;
  });

  readonly snapshotDate = computed<string>(() => this.summary()?.snapshot?.fecha_min ?? '');

  constructor() {
    // Keep `filters.fuentes` synced with what the API exposes so
    // child pages (or future filters that need the master list)
    // can rely on it. Defensive — `availableFuentes()` already
    // computes from the loaded payloads.
    effect(() => {
      const fuentes = this.availableFuentes();
      if (fuentes.length) this.filters.fuentes.set(fuentes);
    });
    effect(() => {
      const cats = this.availableCategorias();
      if (cats.length) this.filters.categorias.set(cats);
    });

    this.dashboardService.getPreguntaPrincipal().subscribe({
      next: (rows) => this.preguntaPrincipal.set(rows ?? []),
    });
    this.dashboardService.getOutliers().subscribe({
      next: (rows) => this.outliers.set(rows ?? []),
    });
    this.dashboardService.getTimeSeries().subscribe({
      next: (resp) => this.timeSeries.set(resp?.series ?? []),
    });
    this.dashboardService.getSummary().subscribe({
      next: (s) => this.summary.set(s),
    });
  }
}