import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ThemeTokenService } from '../../core/theme-token.service';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexLegend, ApexGrid, ApexDataLabels, ApexPlotOptions } from 'ng-apexcharts';
import type { EncuestaRow } from '../../core/dashboard.types';

/**
 * Heatmap: Sitio preferido × Gasto promedio (count).
 *
 * Recibe filas filtradas (EncuestaRow) y construye:
 * - series: [{name: 'sitio' / 'N sitios', data: [{x: gasto, y: count}, ...]}]
 * - xaxis: categories (gasto buckets ordenados)
 *
 * Uso:
 *   <app-encuesta-heatmap-chart
 *     [rows]="store.filteredEncuesta()"
 *     [color]="'#3b82f6'"
 *   />
 */
@Component({
  selector: 'app-encuesta-heatmap-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    <div class="chart-host" [style.height.px]="height()">
      <apx-chart
        [chart]="chart()"
        [series]="series()"
        [xaxis]="xaxis()"
        [colors]="[color()]"
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
        min-height: 340px;
      }
    `,
  ],
})
export class EncuestaHeatmapChartComponent {
  private readonly theme = inject(ThemeTokenService);
  readonly rows = input.required<EncuestaRow[]>();
  readonly color = input<string>('#3b82f6');
  readonly height = input<number>(380);

  private sitioLabelFallback(sitios: string[]): string {
    if (sitios.length === 1) return sitios[0];
    if (sitios.length === 0) return 'Sin datos';
    return `${sitios.length} sitios`;
  }

  readonly chart = computed<ApexChart>(() => ({
    type: 'heatmap' as const,
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: this.theme.charts().foreColor,
  }));

  readonly series = computed<ApexAxisChartSeries>(() => {
    const rows = this.rows();
    const sitios = Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
    const gastos = Array.from(new Set(rows.map((r) => r.gasto_promedio))).sort();

    return sitios.map((sitio) => ({
      name: sitio,
      data: gastos.map((gasto) => ({
        x: gasto,
        y: rows.filter((r) => r.sitio_preferido === sitio && r.gasto_promedio === gasto).length,
      })),
    }));
  });

  readonly xaxis = computed<ApexXAxis>(() => {
    const rows = this.rows();
    const gastos = Array.from(new Set(rows.map((r) => r.gasto_promedio))).sort();
    return {
      categories: gastos,
      labels: { style: { colors: '#374151' } },
      title: { text: 'Gasto promedio (USD)' },
    };
  });

  readonly dataLabels = computed<ApexDataLabels>(() => ({ enabled: true }));
  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly grid = computed<ApexGrid>(() => ({ borderColor: this.theme.charts().grid }));
  readonly plotOptions = computed<ApexPlotOptions>(() => ({
    heatmap: {
      shadeIntensity: 0.5,
      radius: 4,
      colorScale: {
        ranges: [
          { from: 0, to: 1, color: '#dbeafe', name: '0-1' },
          { from: 2, to: 3, color: '#93c5fd', name: '2-3' },
          { from: 4, to: 5, color: '#60a5fa', name: '4-5' },
          { from: 6, to: 10, color: '#3b82f6', name: '6-10' },
          { from: 11, to: 100, color: '#1d4ed8', name: '11+' },
        ],
      },
    },
  }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Heatmap: Sitio preferido × Gasto promedio',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: this.theme.charts().labelColor },
  }));
}