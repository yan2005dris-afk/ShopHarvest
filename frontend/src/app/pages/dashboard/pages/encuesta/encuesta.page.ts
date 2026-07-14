import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/dashboard.store';
import { EncuestaFrecuenciaChartComponent } from '../../shared/charts/encuesta-frecuencia.chart';
import { EncuestaHeatmapChartComponent } from '../../shared/charts/encuesta-heatmap.chart';
import { EncuestaGeneroChartComponent } from '../../shared/charts/encuesta-genero.chart';
import { ChartCardComponent } from '../../shared/chart-card/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';

/**
 * Encuesta page — consumer behaviour analytics.
 *
 * Layout: small KPI strip on top (total respuestas, distribuciones),
 * then 3 chart cards in a 12-column responsive grid:
 *
 *   1. Sitio preferido × frecuencia  (grouped bar)
 *   2. Heatmap sitio × gasto         (heatmap)
 *   3. Distribución por género        (pie / donut)
 *
 * The same `DashboardStore` powers the fuente filter; we only filter
 * by `sitio_preferido` (mapped to `fuentes`) because the encuesta DTO
 * does not carry a `categoria` field.
 */
@Component({
  selector: 'app-encuesta-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EncuestaFrecuenciaChartComponent,
    EncuestaHeatmapChartComponent,
    EncuestaGeneroChartComponent,
    ChartCardComponent,
    KpiCardComponent,
  ],
  template: `
    <header class="page-header">
      <h1>Comportamiento del consumidor</h1>
      <p class="page-sub">
        3 visualizaciones sobre la encuesta de preferencia de plataformas.
      </p>
    </header>

    <!-- ─── Encuesta KPIs ────────────────────────────────── -->
    <section class="kpi-grid">
      <app-kpi-card
        label="Total respuestas"
        [value]="totalRespuestas()"
        icon="📋"
        accent="#60a5fa"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Sitios evaluados"
        [value]="sitiosCount()"
        icon="🌐"
        accent="#a78bfa"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Sitio top"
        [value]="sitioTop()"
        [delta]="sitioTopPct()"
        icon="🏆"
        accent="#fbbf24"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Frecuencia común"
        [value]="frecuenciaComun()"
        icon="📈"
        accent="#34d399"
        [loading]="store.loading()"
      />
    </section>

    <!-- ─── Charts grid ────────────────────────────────────── -->
    <section class="charts-grid">
      <app-chart-card
        title="Sitio preferido × frecuencia"
        caption="Cantidad de encuestados por combinación"
        class="charts-grid__span-12"
      >
        <app-encuesta-frecuencia-chart
          [rows]="store.filteredEncuesta()"
          [colors]="palette"
        />
      </app-chart-card>

      <app-chart-card
        title="Heatmap sitio × gasto"
        caption="Distribución de los niveles de gasto promedio"
        class="charts-grid__span-6"
      >
        <app-encuesta-heatmap-chart
          [rows]="store.filteredEncuesta()"
          color="#60a5fa"
        />
      </app-chart-card>

      <app-chart-card
        title="Distribución por género"
        caption="Participación por género en la encuesta"
        class="charts-grid__span-6"
      >
        <app-encuesta-genero-chart
          [rows]="store.filteredEncuesta()"
          [colors]="palette"
        />
      </app-chart-card>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-header h1 {
        margin: 0 0 0.25rem;
        font-size: 1.875rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--text-1);
      }
      .page-sub {
        margin: 0 0 1.5rem;
        color: var(--text-3);
        font-size: 0.875rem;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 1rem;
      }
      .charts-grid__span-12 { grid-column: span 12; }
      .charts-grid__span-6 { grid-column: span 12; }
      @media (min-width: 900px) {
        .charts-grid__span-6 { grid-column: span 6; }
      }
    `,
  ],
})
export class EncuestaPage {
  readonly store = inject(DashboardStore);

  readonly palette = [
    '#60a5fa',
    '#34d399',
    '#fbbf24',
    '#fb7185',
    '#a78bfa',
    '#f472b6',
  ];

  // ─── Encuesta KPIs derivations ────────────────────────────

  readonly totalRespuestas = computed<string | number>(() => {
    const rows = this.store.filteredEncuesta();
    if (!rows.length) return '—';
    return rows.reduce((acc, r) => acc + (r.total_encuestados ?? 0), 0);
  });

  readonly sitiosCount = computed<string | number>(() => {
    const rows = this.store.filteredEncuesta();
    if (!rows.length) return '—';
    return new Set(rows.map((r) => r.sitio_preferido)).size;
  });

  readonly sitioTop = computed<string>(() => {
    const rows = this.store.filteredEncuesta();
    if (!rows.length) return '—';
    const bySite = new Map<string, number>();
    for (const r of rows) {
      bySite.set(
        r.sitio_preferido,
        (bySite.get(r.sitio_preferido) ?? 0) + (r.total_encuestados ?? 0),
      );
    }
    const sorted = [...bySite.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? '—';
  });

  readonly sitioTopPct = computed<string>(() => {
    const rows = this.store.filteredEncuesta();
    if (!rows.length) return '';
    const total = rows.reduce((acc, r) => acc + (r.total_encuestados ?? 0), 0);
    if (!total) return '';
    const bySite = new Map<string, number>();
    for (const r of rows) {
      bySite.set(
        r.sitio_preferido,
        (bySite.get(r.sitio_preferido) ?? 0) + (r.total_encuestados ?? 0),
      );
    }
    const sorted = [...bySite.entries()].sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return '';
    const pct = (sorted[0][1] / total) * 100;
    return `${pct.toFixed(1)}% de preferencia`;
  });

  readonly frecuenciaComun = computed<string>(() => {
    const rows = this.store.filteredEncuesta();
    if (!rows.length) return '—';
    const byFreq = new Map<string, number>();
    for (const r of rows) {
      byFreq.set(
        r.frecuencia,
        (byFreq.get(r.frecuencia) ?? 0) + (r.total_encuestados ?? 0),
      );
    }
    const sorted = [...byFreq.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? '—';
  });
}
