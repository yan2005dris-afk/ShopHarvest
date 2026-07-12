import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/dashboard.store';
import { EncuestaFrecuenciaChartComponent } from '../../shared/charts/encuesta-frecuencia.chart';
import { EncuestaHeatmapChartComponent } from '../../shared/charts/encuesta-heatmap.chart';
import { EncuestaGeneroChartComponent } from '../../shared/charts/encuesta-genero.chart';

/**
 * Encuesta page — consumer behaviour analytics.
 *
 * Three views from the `dw.fact_encuesta_consumo` rows:
 *   1. Grouped bar: sitio_preferido × frecuencia_compra (count).
 *   2. Heatmap: sitio_preferido × gasto_promedio (count).
 *   3. Pie chart: distribución por género.
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
  ],
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
        <app-encuesta-frecuencia-chart
          [rows]="store.filteredEncuesta()"
          [colors]="palette"
        />
      </article>

      <article class="chart-card">
        <header class="chart-card__header">
          <h2>2 · Heatmap sitio × gasto</h2>
          <p>Distribución de los niveles de gasto promedio</p>
        </header>
        <app-encuesta-heatmap-chart
          [rows]="store.filteredEncuesta()"
          [color]="'#3b82f6'"
        />
      </article>

      <article class="chart-card">
        <header class="chart-card__header">
          <h2>3 · Distribución por género</h2>
          <p>Participación por género en la encuesta</p>
        </header>
        <app-encuesta-genero-chart
          [rows]="store.filteredEncuesta()"
          [colors]="palette"
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
  readonly store = inject(DashboardStore);

  readonly palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
}