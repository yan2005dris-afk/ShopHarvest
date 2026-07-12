import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexLegend, ApexGrid, ApexDataLabels, ApexPlotOptions } from 'ng-apexcharts';
import type { PreguntaPrincipalRow } from '../../core/dashboard.types';

/**
 * Barras agrupadas: Precio promedio por fuente × categoría.
 *
 * Recibe filas ya filtradas (PreguntaPrincipalRow) y construye:
 * - series: [{name: fuente, data: [precio por categoria...]}]
 * - xaxis.categories: categorias ordenadas
 *
 * Uso:
 *   <app-precio-promedio-fuente-categoria-chart
 *     [rows]="store.filteredPreguntaPrincipal()"
 *     [colors]="palette"
 *   />
 */
@Component({
  selector: 'app-precio-promedio-fuente-categoria-chart',
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
        [plotOptions]="plotOptions()"
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
export class PrecioPromedioFuenteCategoriaChartComponent {
  readonly rows = input.required<PreguntaPrincipalRow[]>();
  readonly colors = input<string[]>(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
  readonly height = input<number>(320);

  readonly chart = computed<ApexChart>(() => ({
    type: 'bar' as const,
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: '#374151',
  }));

  readonly series = computed<ApexAxisChartSeries>(() => {
    const rows = this.rows();
    const categorias = Array.from(new Set(rows.map((r) => r.categoria))).sort();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    return fuentes.map((fuente) => ({
      name: fuente,
      data: categorias.map(
        (cat) =>
          rows.find((r) => r.fuente === fuente && r.categoria === cat)?.precio_promedio_usd ?? 0,
      ),
    }));
  });

  readonly xaxis = computed<ApexXAxis>(() => {
    const rows = this.rows();
    const categorias = Array.from(new Set(rows.map((r) => r.categoria))).sort();
    return { categories: categorias };
  });

  readonly dataLabels = computed<ApexDataLabels>(() => ({ enabled: false }));
  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly grid = computed<ApexGrid>(() => ({ borderColor: '#e5e7eb' }));
  readonly plotOptions = computed<ApexPlotOptions>(() => ({
    bar: {
      horizontal: false,
      columnWidth: '60%',
      borderRadius: 4,
    },
  }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Precio promedio por fuente × categoría',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: '#111827' },
  }));
}