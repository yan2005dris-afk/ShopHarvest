import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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
import { ThemeTokenService } from '../../core/theme-token.service';

/**
 * Standalone wrapper around the ng-apexcharts `<apx-chart>` element.
 *
 * Why a wrapper:
 *   - Centralises the base chart config (toolbar disabled, animation
 *     defaults, font-family inherit) so every chart on the dashboard
 *     has consistent UX.
 *   - Reads theme tokens (foreColor / grid color / accent) from
 *     `ThemeTokenService` so charts switch light/dark automatically
 *     when the user toggles the theme.
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
  private readonly theme = inject(ThemeTokenService);

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
  readonly grid = input<ApexGrid>({});
  readonly legend = input<ApexLegend>({ position: 'bottom' });

  /** Base chart config — reads theme tokens so charts re-color when the user toggles light/dark. */
  readonly baseChart = computed<ApexChart>(() => {
    const tokens = this.theme.charts();
    return {
      type: this.type(),
      height: this.height(),
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      background: 'transparent',
      foreColor: tokens.foreColor,
    };
  });
}
