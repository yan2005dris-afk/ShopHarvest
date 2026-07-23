import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ThemeTokenService } from '../../core/theme-token.service';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexTitleSubtitle,
  ApexLegend,
  ApexGrid,
  ApexDataLabels,
} from 'ng-apexcharts';
import type { OutlierRow } from '../../core/dashboard.types';

/**
 * Scatter: Precio por producto coloreado por clasificación IQR.
 *
 * Recibe filas filtradas (OutlierRow) y construye:
 * - series: [{name: clasificacion, data: [{x: index, y: precio}, ...]}, ...]
 * - xaxis: numeric (índice de producto)
 *
 * Uso:
 *   <app-dispersion-outliers-chart
 *     [rows]="store.filteredOutliers()"
 *     [colors]="['#10b981', '#ef4444', '#f59e0b']"
 *   />
 */
@Component({
  selector: 'app-dispersion-outliers-chart',
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
export class DispersionOutliersChartComponent {
  private readonly theme = inject(ThemeTokenService);
  readonly rows = input.required<OutlierRow[]>();
  readonly colors = input<string[]>(['#10b981', '#ef4444', '#f59e0b']);
  readonly height = input<number>(320);

  readonly chart = computed<ApexChart>(() => ({
    type: 'scatter' as const,
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: this.theme.charts().foreColor,
  }));

  readonly series = computed<ApexAxisChartSeries>(() => {
    const rows = this.rows();
    const groups = new Map<string, { x: number; y: number }[]>();
    rows.forEach((r, i) => {
      const key = r.clasificacion ?? 'NORMAL';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ x: i, y: r.precio_usd });
    });
    return Array.from(groups.entries()).map(([name, data]) => ({ name, data }));
  });

  readonly xaxis = computed<ApexXAxis>(() => ({
    type: 'numeric' as const,
    title: { text: 'Producto (índice)' },
    labels: { rotate: 0 },
  }));

  readonly dataLabels = computed<ApexDataLabels>(() => ({ enabled: false }));
  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly grid = computed<ApexGrid>(() => ({ borderColor: this.theme.charts().grid }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Dispersión de outliers (IQR) — Precio por producto',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: this.theme.charts().labelColor },
  }));
}
