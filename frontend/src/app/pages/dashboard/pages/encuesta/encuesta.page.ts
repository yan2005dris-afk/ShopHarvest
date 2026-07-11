import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DashboardService } from '../../core/dashboard.service';
import { KpiFiltersService } from '../../core/kpi-filters.service';
import type { EncuestaRow } from '../../core/dashboard.types';
import { ChartHostComponent } from '../../shared/chart-host/chart-host.component';

/**
 * Friendly fallback for the heatmap series name when more than one
 * sitio is on screen. With one sitio we use the name directly so the
 * legend stays meaningful.
 */
function sitioLabelFallback(sitios: string[]): string {
  if (sitios.length === 1) return sitios[0];
  if (sitios.length === 0) return 'Sin datos';
  return `${sitios.length} sitios`;
}

/**
 * Encuesta page — consumer behaviour analytics.
 *
 * Three views from the `dw.fact_encuesta_consumo` rows:
 *   1. Grouped bar: sitio_preferido × frecuencia_compra (count).
 *   2. Heatmap: sitio_preferido × gasto_promedio (count).
 *   3. Pie chart: distribución por género.
 *
 * The same `KpiFiltersService` powers the fuente / categoria selects
 * at the top; we only filter by `sitio_preferido` (mapped to the
 * `fuenteSeleccionada` signal) because the encuesta DTO does not
 * carry a `categoria` field.
 */
@Component({
  selector: 'app-encuesta-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartHostComponent],
  template: `
    <header class="page-header">
      <h1>Comportamiento del consumidor</h1>
      <p class="page-sub">
        3 visualizaciones sobre la encuesta de preferencia de plataformas
        (24 respuestas).
      </p>
    </header>

    <section class="charts">
      <article class="chart-card">
        <header class="chart-card__header">
          <h2>1 · Sitio preferido × frecuencia</h2>
          <p>Cuántos encuestados por combinación sitio / frecuencia</p>
        </header>
        <app-chart-host
          [type]="'bar'"
          [series]="freqSeries()"
          [xaxis]="freqXaxis()"
          [colors]="palette"
        />
      </article>

      <article class="chart-card">
        <header class="chart-card__header">
          <h2>2 · Heatmap sitio × gasto</h2>
          <p>Distribución de los niveles de gasto promedio</p>
        </header>
        <app-chart-host
          [type]="'heatmap'"
          [series]="heatmapSeries()"
          [xaxis]="heatmapXaxis()"
          [colors]="['#3b82f6']"
        />
      </article>

      <article class="chart-card">
        <header class="chart-card__header">
          <h2>3 · Distribución por género</h2>
          <p>Participación por género en la encuesta</p>
        </header>
        <app-chart-host
          [type]="'pie'"
          [series]="pieSeries()"
          [labels]="pieLabels()"
          [colors]="palette"
          [legend]="{ position: 'bottom' }"
        />
      </article>
    </section>
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
      .charts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: 1.5rem;
      }
      @media (max-width: 600px) {
        .charts {
          grid-template-columns: 1fr;
        }
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
export class EncuestaPage {
  private readonly dashboardService = inject(DashboardService);
  private readonly filters = inject(KpiFiltersService);

  readonly palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  readonly rows = signal<EncuestaRow[]>([]);

  /** Apply the active fuente filter to the loaded encuesta rows. */
  readonly filteredRows = computed<EncuestaRow[]>(() => {
    const fuentes = new Set(this.filters.fuenteSeleccionada());
    const all = this.rows();
    return all.filter((r) => !fuentes.size || fuentes.has(r.sitio_preferido));
  });

  // ─── Chart 1: Grouped bar sitio × frecuencia ──────────────

  readonly freqSeries = computed<any[]>(() => {
    const rows = this.filteredRows();
    const sitios = Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
    const freqs = Array.from(new Set(rows.map((r) => r.frecuencia))).sort();
    return freqs.map((freq) => ({
      name: freq,
      data: sitios.map(
        (sitio) => rows.filter((r) => r.sitio_preferido === sitio && r.frecuencia === freq).length,
      ),
    }));
  });

  readonly freqXaxis = computed<any>(() => {
    const sitios = Array.from(
      new Set(this.filteredRows().map((r) => r.sitio_preferido)),
    ).sort();
    return { categories: sitios };
  });

  // ─── Chart 2: Heatmap sitio × gasto ───────────────────────

  /**
   * Apex heatmap shape: a single series with one entry per (sitio,
   * gasto) tuple. `x` is the gasto bucket (categorical x-axis),
   * `y` is the count. We compute the count once per cell instead
   * of nesting arrays — that matches the actual `apexcharts` heatmap
   * contract and avoids the (x, y) duplicate-collapse hack.
   */
  readonly heatmapSeries = computed<any[]>(() => {
    const rows = this.filteredRows();
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
    return [{ name: sitioLabelFallback(sitios), data }];
  });

  readonly heatmapXaxis = computed<any>(() => {
    const rows = this.filteredRows();
    const sitios = Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
    const gastos = Array.from(new Set(rows.map((r) => r.gasto_promedio))).sort();
    return {
      categories: gastos,
      labels: { style: { colors: '#374151' } },
      title: { text: 'Gasto promedio (USD)' },
    };
  });

  // ─── Chart 3: Pie por género ──────────────────────────────

  readonly pieSeries = computed<number[]>(() => {
    const rows = this.filteredRows();
    const generos = Array.from(new Set(rows.map((r) => r.genero))).sort();
    return generos.map((g) => rows.filter((r) => r.genero === g).length);
  });

  /**
   * ApexCharts pie/donut charts ignore `xaxis.categories` — the
   * slice names come from `labels` instead (CodeRabbit finding, PR #11).
   */
  readonly pieLabels = computed<string[]>(() =>
    Array.from(new Set(this.filteredRows().map((r) => r.genero))).sort(),
  );

  constructor() {
    this.dashboardService.getEncuesta().subscribe({
      next: (rows) => this.rows.set(rows ?? []),
    });
  }
}