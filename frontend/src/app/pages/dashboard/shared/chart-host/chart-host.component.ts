import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexTitleSubtitle,
  ApexXAxis,
  ApexYAxis,
  ChartType,
} from 'ng-apexcharts';

/**
 * Standalone wrapper around the ng-apexcharts `<apx-chart>` element.
 *
 * Why a wrapper:
 *   - Centralises the base chart config (toolbar disabled, animation
 *     defaults, font-family inherit) so every chart on the dashboard
 *     has consistent UX.
 *   - Forwards the dynamic inputs (`series`, `xaxis`, `title`, etc.)
 *     to `<apx-chart>` directly with the proper Apex types.
 *
 * Usage:
 *   <app-chart-host
 *     [type]="'bar'"
 *     [series]="mySeries"
 *     [xaxis]="myXaxis"
 *     [colors]="['#3b82f6']"
 *   />
 */
@Component({
  selector: 'app-chart-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    <div class="chart-host" [style.height.px]="height()">
      <apx-chart
        [chart]="baseChart()"
        [series]="series()"
        [xaxis]="xaxis()"
        [labels]="labels()"
        [colors]="colors()"
        [title]="title()"
        [plotOptions]="plotOptions()"
        [dataLabels]="dataLabels()"
        [yaxis]="yaxis()"
        [grid]="grid()"
        [legend]="legend()"
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
        min-height: 240px;
      }
    `,
  ],
})
export class ChartHostComponent {
  readonly type = input.required<ChartType>();
  readonly series = input.required<ApexAxisChartSeries | ApexNonAxisChartSeries>();
  readonly xaxis = input<ApexXAxis>({});
  /** Slice names for pie/donut charts — ApexCharts ignores xaxis.categories for these types. */
  readonly labels = input<string[]>([]);
  readonly colors = input<string[]>(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
  readonly height = input<number>(320);
  readonly title = input<ApexTitleSubtitle>({} as ApexTitleSubtitle);
  readonly plotOptions = input<ApexPlotOptions>({});
  readonly dataLabels = input<ApexDataLabels>({ enabled: false });
  readonly yaxis = input<ApexYAxis | ApexYAxis[]>({} as ApexYAxis);
  readonly grid = input<ApexGrid>({ borderColor: '#e5e7eb' });
  readonly legend = input<ApexLegend>({ position: 'bottom' });

  /**
   * Static-ish base config: only `type` and `height` change at
   * runtime; everything else is the dashboard's house style.
   */
  readonly baseChart = computed<ApexChart>(() => ({
    type: this.type(),
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: '#374151',
  }));
}