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
 * Sprint 6: tokens migrated to Insight Flow (Material 3 + Tailwind
 * v4 utility classes). KPI icons switched from emoji to Material
 * Symbols names (the kpi-card input now expects icon names, not
 * emoji, per Sprint 3). The chart palette is kept as literal hex
 * values because the chart components consume them as data
 * attributes, not CSS classes.
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
    <header class="mb-6">
      <h1 class="text-headline-lg text-on-surface m-0 mb-1 font-bold tracking-tight">
        Comportamiento del consumidor
      </h1>
      <p class="text-body-md text-on-surface-variant m-0">
        3 visualizaciones sobre la encuesta de preferencia de plataformas.
      </p>
    </header>

    <!-- ─── Encuesta KPIs ────────────────────────────────── -->
    <section
      class="mb-8 grid gap-4"
      style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))"
      aria-label="Encuesta KPIs"
    >
      <app-kpi-card
        label="Total respuestas"
        [value]="totalRespuestas()"
        icon="fact_check"
        accent="secondary"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Sitios evaluados"
        [value]="sitiosCount()"
        icon="public"
        accent="secondary"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Sitio top"
        [value]="sitioTop()"
        [delta]="sitioTopPct()"
        icon="emoji_events"
        accent="warning"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Frecuencia común"
        [value]="frecuenciaComun()"
        icon="trending_up"
        accent="success"
        [loading]="store.loading()"
      />
    </section>

    <!-- ─── Charts grid ────────────────────────────────────── -->
    <section
      class="grid gap-4"
      style="grid-template-columns: repeat(12, 1fr)"
      aria-label="Encuesta charts"
    >
      <div class="col-span-12">
        <app-chart-card
          title="Sitio preferido × frecuencia"
          caption="Cantidad de encuestados por combinación"
        >
          <app-encuesta-frecuencia-chart
            [rows]="store.filteredEncuesta()"
            [colors]="palette"
          />
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-6">
        <app-chart-card
          title="Heatmap sitio × gasto"
          caption="Distribución de los niveles de gasto promedio"
        >
          <app-encuesta-heatmap-chart
            [rows]="store.filteredEncuesta()"
            color="#60a5fa"
          />
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-6">
        <app-chart-card
          title="Distribución por género"
          caption="Participación por género en la encuesta"
        >
          <app-encuesta-genero-chart
            [rows]="store.filteredEncuesta()"
            [colors]="palette"
          />
        </app-chart-card>
      </div>
    </section>
  `,
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