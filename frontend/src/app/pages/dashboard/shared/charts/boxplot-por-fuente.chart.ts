import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexLegend, ApexGrid, ApexDataLabels, ApexPlotOptions } from 'ng-apexcharts';
import type { OutlierRow } from '../../core/dashboard.types';

/**
 * BoxPlot por fuente: distribución del rango de precios detectado como outlier.
 *
 * Recibe filas filtradas (OutlierRow) y construye:
 * - series: [{data: [{x: fuente, y: [min, Q1, median, Q3, max]}, ...]}]
 * - xaxis: category (fuentes ordenadas)
 *
 * Uso:
 *   <app-boxplot-por-fuente-chart
 *     [rows]="store.filteredOutliers()"
 *     [colors]="palette"
 *   />
 */
@Component({
  selector: 'app-boxplot-por-fuente-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    <div class="chart-host" [style.height.px]="height()">
      <apx-chart
        [chart]="chart()"
        [series]="series()"
        [xaxis]="xaxis()"
        [colors]="colors()"
        [dataLabels]="dataLabels()"
        [legend]="legend()"
        [grid]="grid()"
        [plotOptions]="plotOptions()"
        [title]="title()"
      ></apx-chart>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .chart-host {
        width: 100%;
        min-height: 280px;
      }
    `,
  ],
})
export class BoxPlotPorFuenteChartComponent {
  readonly rows = input.required<OutlierRow[]>();
  readonly colors = input<string[]>(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
  readonly height = input<number>(320);

  private fiveNumberSummary(arr: number[]): [number, number, number, number, number] {
    const sorted = [...arr].sort((a, b) => a - b);
    const q = (quantile: number) => {
      const pos = (sorted.length - 1) * quantile;
      const base = Math.floor(pos);
      const rest = pos - base;
      return sorted[base + 1] !== undefined
        ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
        : sorted[base];
    };
    return [sorted[0], q(0.25), q(0.5), q(0.75), sorted[sorted.length - 1]];
  }

  readonly chart = computed<ApexChart>(() => ({
    type: 'boxPlot' as const,
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: '#374151',
  }));

  readonly series = computed<ApexAxisChartSeries>(() => {
    const rows = this.rows();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    const data = fuentes.map((fuente) => {
      const precios = rows.filter((r) => r.fuente === fuente).map((r) => r.precio_usd);
      return {
        x: fuente,
        y: precios.length ? this.fiveNumberSummary(precios) : [0, 0, 0, 0, 0],
      };
    });
    return [{ data }];
  });

  readonly xaxis = computed<ApexXAxis>(() => ({
    type: 'category' as const,
    categories: Array.from(new Set(this.rows().map((r) => r.fuente))).sort(),
  }));

  readonly dataLabels = computed<ApexDataLabels>(() => ({ enabled: false }));
  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly grid = computed<ApexGrid>(() => ({ borderColor: '#e5e7eb' }));
  readonly plotOptions = computed<ApexPlotOptions>(() => ({
    boxPlot: {
      colors: {
        upper: this.colors()[0],
        lower: this.colors()[0],
      },
    },
  }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Box plot por fuente — Distribución del rango de precios outliers',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: '#111827' },
  }));
}