import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ThemeTokenService } from '../../core/theme-token.service';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexLegend, ApexGrid, ApexDataLabels, ApexPlotOptions } from 'ng-apexcharts';
import type { EncuestaRow } from '../../core/dashboard.types';

/**
 * Barras agrupadas: Sitio preferido × Frecuencia de compra (count).
 *
 * Recibe filas filtradas (EncuestaRow) y construye:
 * - series: [{name: frecuencia, data: [count por sitio...]}]
 * - xaxis: categories (sitios ordenados)
 *
 * Uso:
 *   <app-encuesta-frecuencia-chart
 *     [rows]="store.filteredEncuesta()"
 *     [colors]="palette"
 *   />
 */
@Component({
  selector: 'app-encuesta-frecuencia-chart',
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
        [plotOptions]="plotOptions()"
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
export class EncuestaFrecuenciaChartComponent {
  private readonly theme = inject(ThemeTokenService);
  readonly rows = input.required<EncuestaRow[]>();
  readonly colors = input<string[]>(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']);
  readonly height = input<number>(380);

  readonly chart = computed<ApexChart>(() => ({
    type: 'bar' as const,
    height: this.height(),
    stacked: false,
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: this.theme.charts().foreColor,
  }));

  readonly series = computed<ApexAxisChartSeries>(() => {
    const rows = this.rows();
    const sitios = Array.from(new Set(rows.map((r) => r.sitio_preferido))).sort();
    const freqs = Array.from(new Set(rows.map((r) => r.frecuencia))).sort();
    return freqs.map((freq) => ({
      name: freq,
      data: sitios.map(
        (sitio) => rows.filter((r) => r.sitio_preferido === sitio && r.frecuencia === freq).length,
      ),
    }));
  });

  readonly xaxis = computed<ApexXAxis>(() => {
    const sitios = Array.from(
      new Set(this.rows().map((r) => r.sitio_preferido)),
    ).sort();
    return { categories: sitios };
  });

  readonly dataLabels = computed<ApexDataLabels>(() => ({ enabled: false }));
  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly grid = computed<ApexGrid>(() => ({ borderColor: this.theme.charts().grid }));
  readonly plotOptions = computed<ApexPlotOptions>(() => ({
    bar: {
      columnWidth: '70%',
      borderRadius: 4,
    },
  }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Sitio preferido × Frecuencia de compra',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: this.theme.charts().labelColor },
  }));
}