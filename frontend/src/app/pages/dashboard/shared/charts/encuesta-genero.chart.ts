import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ThemeTokenService } from '../../core/theme-token.service';
import type {
  ApexNonAxisChartSeries,
  ApexChart,
  ApexTitleSubtitle,
  ApexLegend,
  ApexGrid,
  ApexDataLabels,
  ApexPlotOptions,
} from 'ng-apexcharts';
import type { EncuestaRow } from '../../core/dashboard.types';

/**
 * Pie / Donut: Distribución por género.
 *
 * Recibe filas filtradas (EncuestaRow) y construye:
 * - series: [count por género...]
 * - labels: [géneros ordenados...]
 *
 * Uso:
 *   <app-encuesta-genero-chart
 *     [rows]="store.filteredEncuesta()"
 *     [colors]="palette"
 *   />
 */
@Component({
  selector: 'app-encuesta-genero-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    <div class="chart-host" [style.height.px]="height()">
      <apx-chart
        [chart]="chart()"
        [series]="series()"
        [labels]="labels()"
        [colors]="colors()"
        [legend]="legend()"
        [dataLabels]="dataLabels()"
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
        min-height: 340px;
      }
    `,
  ],
})
export class EncuestaGeneroChartComponent {
  private readonly theme = inject(ThemeTokenService);
  readonly rows = input.required<EncuestaRow[]>();
  readonly colors = input<string[]>([
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
  ]);
  readonly height = input<number>(380);

  readonly chart = computed<ApexChart>(() => ({
    type: 'pie' as const,
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: this.theme.charts().foreColor,
  }));

  readonly series = computed<ApexNonAxisChartSeries>(() => {
    const rows = this.rows();
    const generos = Array.from(new Set(rows.map((r) => r.genero))).sort();
    return generos.map((g) => rows.filter((r) => r.genero === g).length);
  });

  readonly labels = computed<string[]>(() =>
    Array.from(new Set(this.rows().map((r) => r.genero))).sort(),
  );

  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly dataLabels = computed<ApexDataLabels>(() => ({
    enabled: true,
    formatter: (val: number, opts: { series: number[]; seriesIndex: number; w: any }) => {
      const total = opts.w.config.series.reduce((a: number, b: number) => a + b, 0);
      const pct = total ? ((val / total) * 100).toFixed(1) : '0';
      return `${pct}%`;
    },
    style: { fontSize: '13px', fontWeight: 600, colors: ['#111827'] },
  }));
  readonly plotOptions = computed<ApexPlotOptions>(() => ({
    pie: {
      donut: { size: '55%' },
      expandOnClick: true,
    },
  }));
  readonly grid = computed<ApexGrid>(() => ({ padding: { top: 0, bottom: 0 } }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Distribución por género en la encuesta',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: this.theme.charts().labelColor },
  }));
}
