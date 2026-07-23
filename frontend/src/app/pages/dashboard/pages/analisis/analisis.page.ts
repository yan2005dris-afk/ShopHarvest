import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardStore } from '../../core/dashboard.store';
import { PrecioPromedioFuenteCategoriaChartComponent } from '../../shared/charts/precio-promedio-fuente-categoria.chart';
import { SerieTemporalPreciosChartComponent } from '../../shared/charts/serie-temporal-precios.chart';
import { DispersionOutliersChartComponent } from '../../shared/charts/dispersion-outliers.chart';
import { BoxPlotPorFuenteChartComponent } from '../../shared/charts/boxplot-por-fuente.chart';
import { ChartCardComponent } from '../../shared/chart-card/chart-card.component';

/**
 * Analisis page — 4 chart families + reactive filter sidebar.
 *
 * Family 1: grouped bar of AVG(precio_usd) by fuente × categoria
 * Family 2: line chart of precio promedio por trimestre × fuente
 * Family 3: scatter using the outliers endpoint
 * Family 4: box plot per fuente
 *
 * Sprint 6: tokens migrated to Insight Flow. The filter sidebar
 * keeps the same controls but uses the Insight Flow form-input
 * pattern (bg-surface-container-low, focus:border-primary +
 * focus:ring-2). The chart palette stays as literal hex values
 * because the chart components consume them as data attributes.
 */
@Component({
  selector: 'app-analisis-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PrecioPromedioFuenteCategoriaChartComponent,
    SerieTemporalPreciosChartComponent,
    DispersionOutliersChartComponent,
    BoxPlotPorFuenteChartComponent,
    ChartCardComponent,
  ],
  template: `
    <header class="mb-6">
      <h1 class="text-headline-lg text-on-surface m-0 mb-1 font-bold tracking-tight">
        Análisis de precios
      </h1>
      <p class="text-body-md text-on-surface-variant m-0">
        4 familias de gráficos con filtros reactivos. Cambiá un filtro y los gráficos se recalculan
        automáticamente.
      </p>
    </header>

    @if (store.isSnapshot()) {
      <div
        class="inline-flex items-center gap-2 rounded-full border bg-warning-dim mb-6 px-3 py-1.5 text-label-caps font-semibold text-warning"
        style="border-color: color-mix(in srgb, var(--color-warning) 40%, transparent)"
        role="status"
      >
        <span
          class="h-1.5 w-1.5 rounded-full bg-warning"
          style="box-shadow: 0 0 8px var(--color-warning)"
        ></span>
        <span>
          Serie temporal · <strong>UN SOLO DÍA</strong> ({{ store.snapshotDate() }}). La línea es
          representativa del snapshot, no de una tendencia real.
        </span>
      </div>
    }

    <div class="grid items-start gap-6" style="grid-template-columns: 260px 1fr">
      <aside
        class="sticky top-4 flex flex-col gap-5 rounded-xl border border-outline-variant bg-surface p-5 font-sans"
        aria-label="Filtros globales"
      >
        <h3 class="text-body-lg text-on-surface m-0 font-bold tracking-tight">Filtros</h3>

        <fieldset class="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Fuentes
          </legend>
          @for (f of availableFuentes(); track f) {
            <label
              class="text-body-md text-on-surface-variant flex cursor-pointer items-center gap-2 py-1 transition-colors hover:text-on-surface"
            >
              <input
                type="checkbox"
                class="size-4 cursor-pointer accent-primary"
                [checked]="isFuenteSelected(f)"
                (change)="toggleFuente(f)"
              />
              <span>{{ f }}</span>
            </label>
          }
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Categorías
          </legend>
          @if (availableCategorias().length === 0) {
            <p class="text-body-md text-on-surface-variant m-0 italic">Cargando categorías…</p>
          }
          @for (c of availableCategorias(); track c) {
            <label
              class="text-body-md text-on-surface-variant flex cursor-pointer items-center gap-2 py-1 transition-colors hover:text-on-surface"
            >
              <input
                type="checkbox"
                class="size-4 cursor-pointer accent-primary"
                [checked]="isCategoriaSelected(c)"
                (change)="toggleCategoria(c)"
              />
              <span>{{ c }}</span>
            </label>
          }
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Rango de precio (USD)
          </legend>
          <div class="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              class="w-[90px] rounded-md border border-outline-variant bg-surface-container-low px-2 py-1.5 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
              [ngModel]="rangoMin()"
              (ngModelChange)="setRangoMin($event)"
              aria-label="Precio mínimo"
            />
            <span class="text-on-surface-variant">—</span>
            <input
              type="number"
              min="0"
              step="1"
              class="w-[90px] rounded-md border border-outline-variant bg-surface-container-low px-2 py-1.5 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
              [ngModel]="rangoMax()"
              (ngModelChange)="setRangoMax($event)"
              aria-label="Precio máximo"
            />
          </div>
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Rango de fechas
          </legend>
          @if (!store.timeRangeIsApplicable()) {
            <p class="text-body-md text-on-surface-variant m-0 italic" role="note">
              El DW es un snapshot de un solo día
              @if (store.timeRangeBounds().min) {
                ({{ store.timeRangeBounds().min }})
              }
              . El filtro temporal se activa cuando hay más de una fecha capturada en
              <code class="rounded-xs bg-surface-container-low px-1 py-0.5 font-mono text-body-md"
                >dim_tiempo</code
              >.
            </p>
          } @else {
            <div class="flex flex-col gap-2">
              <label
                class="text-body-md text-on-surface-variant grid grid-cols-[60px_1fr] cursor-pointer items-center gap-2 py-1"
              >
                <span
                  class="text-label-caps text-on-surface-variant font-semibold tracking-wider uppercase"
                  >Desde</span
                >
                <input
                  type="date"
                  class="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1.5 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                  style="color-scheme: light dark"
                  [min]="store.timeRangeBounds().min"
                  [max]="store.timeRangeBounds().max"
                  [value]="fechaDesde() ?? ''"
                  (change)="setFechaDesde($event)"
                  [attr.aria-label]="'Fecha desde'"
                />
              </label>
              <label
                class="text-body-md text-on-surface-variant grid grid-cols-[60px_1fr] cursor-pointer items-center gap-2 py-1"
              >
                <span
                  class="text-label-caps text-on-surface-variant font-semibold tracking-wider uppercase"
                  >Hasta</span
                >
                <input
                  type="date"
                  class="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1.5 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                  style="color-scheme: light dark"
                  [min]="store.timeRangeBounds().min"
                  [max]="store.timeRangeBounds().max"
                  [value]="fechaHasta() ?? ''"
                  (change)="setFechaHasta($event)"
                  [attr.aria-label]="'Fecha hasta'"
                />
              </label>
            </div>
            <p
              class="text-label-caps text-on-surface-variant mt-2 leading-snug tracking-wider uppercase"
            >
              Aplica a la serie temporal. La granularidad del DW es trimestral.
            </p>
          }
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Restricciones
          </legend>
          <label
            class="text-body-md text-on-surface-variant flex cursor-pointer items-center gap-2 py-1 transition-colors hover:text-on-surface"
          >
            <input
              type="checkbox"
              class="size-4 cursor-pointer accent-primary"
              [ngModel]="store.filtros().soloConDisponibilidad"
              (ngModelChange)="store.setSoloConDisponibilidad($event)"
            />
            <span>Solo con disponibilidad</span>
          </label>
          <label
            class="text-body-md text-on-surface-variant flex cursor-pointer items-center gap-2 py-1 transition-colors hover:text-on-surface"
          >
            <input
              type="checkbox"
              class="size-4 cursor-pointer accent-primary"
              [ngModel]="store.filtros().soloConCalificacion"
              (ngModelChange)="store.setSoloConCalificacion($event)"
            />
            <span>Solo con calificación</span>
          </label>
        </fieldset>

        <button
          type="button"
          class="mt-2 cursor-pointer rounded-md border border-outline-variant bg-surface-container-low px-4 py-2 text-body-md font-semibold text-on-surface-variant transition-colors hover:bg-primary-dim hover:text-on-surface"
          (click)="store.resetFilters()"
        >
          Limpiar filtros
        </button>
      </aside>

      <section
        class="grid gap-4"
        style="grid-template-columns: repeat(12, 1fr)"
        aria-label="Análisis de precios"
      >
        <div class="col-span-12">
          <app-chart-card
            title="Barras correlacionales"
            caption="Precio promedio por fuente × categoría"
          >
            <app-precio-promedio-fuente-categoria-chart
              [rows]="store.filteredPreguntaPrincipal()"
              [colors]="palette"
            />
          </app-chart-card>
        </div>

        <div class="col-span-12">
          <app-chart-card title="Serie temporal" caption="Precio promedio por trimestre">
            <app-serie-temporal-precios-chart
              [rows]="store.filteredTimeSeries()"
              [colors]="palette"
              [isSnapshot]="store.isSnapshot()"
              [snapshotDate]="store.snapshotDate()"
            />
          </app-chart-card>
        </div>

        <div class="col-span-12 md:col-span-6">
          <app-chart-card
            title="Dispersión de outliers (IQR)"
            caption="Precio por producto coloreado por clasificación"
          >
            <app-dispersion-outliers-chart
              [rows]="store.filteredOutliers()"
              [colors]="['#10b981', '#ef4444', '#f59e0b']"
            />
          </app-chart-card>
        </div>

        <div class="col-span-12 md:col-span-6">
          <app-chart-card
            title="Box plot por fuente"
            caption="Distribución del rango de precios detectado como outlier"
          >
            <app-boxplot-por-fuente-chart [rows]="store.filteredOutliers()" [colors]="palette" />
          </app-chart-card>
        </div>
      </section>
    </div>
  `,
})
export class AnalisisPage {
  readonly store = inject(DashboardStore);

  /** Distinct palette to keep chart 1 / 2 / 4 visually consistent. */
  readonly palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // ─── Sidebar filter helpers ───────────────────────────────

  readonly availableFuentes = computed<string[]>(() => {
    const fromMain = this.store.preguntaPrincipal().map((r) => r.fuente);
    const fromOutliers = this.store.outliers().map((r) => r.fuente);
    const fromTs = this.store.timeSeries().map((r) => r.fuente);
    return Array.from(new Set([...fromMain, ...fromOutliers, ...fromTs])).sort();
  });

  readonly availableCategorias = computed<string[]>(() => {
    const fromMain = this.store.preguntaPrincipal().map((r) => r.categoria);
    return Array.from(new Set(fromMain)).sort();
  });

  readonly rangoMin = computed(() => this.store.filtros().rangoPrecio[0]);
  readonly rangoMax = computed(() => this.store.filtros().rangoPrecio[1]);
  readonly fechaDesde = computed(() => this.store.filtros().fechaDesde);
  readonly fechaHasta = computed(() => this.store.filtros().fechaHasta);

  isFuenteSelected(value: string): boolean {
    return this.store.filtros().fuentes.includes(value);
  }
  isCategoriaSelected(value: string): boolean {
    return this.store.filtros().categorias.includes(value);
  }
  toggleFuente(value: string): void {
    this.store.toggleFuente(value);
  }
  toggleCategoria(value: string): void {
    this.store.toggleCategoria(value);
  }
  setRangoMin(value: number): void {
    const [, max] = this.store.filtros().rangoPrecio;
    this.store.setRangoPrecio(Number(value) || 0, max);
  }
  setRangoMax(value: number): void {
    const [min] = this.store.filtros().rangoPrecio;
    this.store.setRangoPrecio(min, Number(value) || 0);
  }

  /**
   * Date-range handlers for the new "Rango de fechas" fieldset.
   * Empty value → null (treated as "no bound" by the store).
   */
  setFechaDesde(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.store.setFechaRange(value, this.store.filtros().fechaHasta);
  }
  setFechaHasta(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.store.setFechaRange(this.store.filtros().fechaDesde, value);
  }
}
