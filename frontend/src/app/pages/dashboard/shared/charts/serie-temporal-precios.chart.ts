import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ThemeTokenService } from '../../core/theme-token.service';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexLegend, ApexGrid, ApexDataLabels } from 'ng-apexcharts';
import type { TimeSeriesRow } from '../../core/dashboard.types';

/**
 * Línea: Precio promedio por trimestre × fuente (snapshot).
 *
 * Recibe filas filtradas (TimeSeriesRow) y construye:
 * - series: [{name: fuente, data: [precio por trimestre...]}] — con `null` para trimestres faltantes
 * - xaxis.categories: ["Q1 2024", "Q2 2024", ...] — ordenadas por primera aparición
 *
 * Uso:
 *   <app-serie-temporal-precios-chart
 *     [rows]="store.filteredTimeSeries()"
 *     [colors]="palette"
 *   />
 */
@Component({
  selector: 'app-serie-temporal-precios-chart',
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

    @if (isSnapshot()) {
      <div class="snapshot-badge" role="status">
        <span aria-hidden="true">⚠️</span>
        <span>
          Serie temporal con <strong>UN SOLO DÍA</strong> de datos
          ({{ snapshotDate() }}). La línea es representativa del snapshot, no de
          una tendencia temporal real.
        </span>
      </div>
    }
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
      .snapshot-badge {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-top: 1rem;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class SerieTemporalPreciosChartComponent {
  private readonly theme = inject(ThemeTokenService);
  readonly rows = input.required<TimeSeriesRow[]>();
  readonly colors = input<string[]>(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
  readonly height = input<number>(320);
  readonly isSnapshot = input<boolean>(false);
  readonly snapshotDate = input<string>('');

  // Ordered quarter keys: ["2024-Q1", "2024-Q2", ...]
  readonly quarterKeys = computed<string[]>(() => {
    const rows = this.rows();
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const r of rows) {
      const key = `${r.anio}-Q${r.trimestre}`;
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
    return keys.sort();
  });

  readonly chart = computed<ApexChart>(() => ({
    type: 'line' as const,
    height: this.height(),
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: 'transparent',
    foreColor: this.theme.charts().foreColor,
  }));

  readonly series = computed<ApexAxisChartSeries>(() => {
    const rows = this.rows();
    const fuentes = Array.from(new Set(rows.map((r) => r.fuente))).sort();
    const keys = this.quarterKeys();
    return fuentes.map((fuente) => ({
      name: fuente,
      data: keys.map((key) => {
        const row = rows.find(
          (r) => r.fuente === fuente && `${r.anio}-Q${r.trimestre}` === key,
        );
        return row ? row.precio_promedio : null;
      }),
    }));
  });

  readonly xaxis = computed<ApexXAxis>(() => {
    const rows = this.rows();
    const keys = this.quarterKeys();
    const labelMap = new Map<string, string>();
    for (const r of rows) {
      const key = `${r.anio}-Q${r.trimestre}`;
      if (!labelMap.has(key)) labelMap.set(key, `Q${r.trimestre} ${r.anio}`);
    }
    return { categories: keys.map((key) => labelMap.get(key)!) };
  });

  readonly dataLabels = computed<ApexDataLabels>(() => ({ enabled: false }));
  readonly legend = computed<ApexLegend>(() => ({ position: 'bottom' as const }));
  readonly grid = computed<ApexGrid>(() => ({ borderColor: this.theme.charts().grid }));
  readonly title = computed<ApexTitleSubtitle>(() => ({
    text: 'Precio promedio por trimestre (snapshot)',
    align: 'left' as const,
    style: { fontSize: '14px', fontWeight: 600, color: this.theme.charts().labelColor },
  }));
}