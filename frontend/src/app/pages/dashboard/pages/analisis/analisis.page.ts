import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { DashboardStore } from '../../core/dashboard.store';
import { DateRangePickerComponent } from '../../../../shared/date-range-picker/date-range-picker.component';
import { PrecioPromedioFuenteCategoriaChartComponent } from '../../shared/charts/precio-promedio-fuente-categoria.chart';
import { SerieTemporalPreciosChartComponent } from '../../shared/charts/serie-temporal-precios.chart';
import { DispersionOutliersChartComponent } from '../../shared/charts/dispersion-outliers.chart';
import { BoxPlotPorFuenteChartComponent } from '../../shared/charts/boxplot-por-fuente.chart';
import { ChartCardComponent } from '../../shared/chart-card/chart-card.component';

/** Parse a 'YYYY-MM-DD' string (or null) into a local-midnight Date (or null). */
function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if ([y, m, d].some((v) => Number.isNaN(v))) return null;
  return new Date(y, m - 1, d);
}

/** Format a Date as a local 'YYYY-MM-DD' string, or null for "no bound". */
function fromDate(date: Date | null): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-analisis-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    DateRangePickerComponent,
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
      <mat-chip-set class="mb-6">
        <mat-chip class="!min-h-7 !text-xs font-semibold">
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-warning"></span>
            <span
              >Serie temporal · UN SOLO DÍA ({{ store.snapshotDate() }}). La línea es representativa
              del snapshot.</span
            >
          </span>
        </mat-chip>
      </mat-chip-set>
    }

    <div class="grid items-start gap-6" style="grid-template-columns: 260px 1fr">
      <aside
        class="sticky top-4 flex flex-col gap-5 rounded-xl border border-outline-variant bg-surface p-5 font-sans"
        aria-label="Filtros globales"
      >
        <h3 class="text-body-lg text-on-surface m-0 font-bold tracking-tight">Filtros</h3>

        <fieldset class="m-0 flex flex-col gap-1 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Fuentes
          </legend>
          @for (f of availableFuentes(); track f) {
            <mat-checkbox
              [checked]="isFuenteSelected(f)"
              (change)="toggleFuente(f)"
              color="primary"
            >
              {{ f }}
            </mat-checkbox>
          }
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-1 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Categorías
          </legend>
          @if (availableCategorias().length === 0) {
            <p class="text-body-md text-on-surface-variant m-0 italic">Cargando categorías…</p>
          }
          @for (c of availableCategorias(); track c) {
            <mat-checkbox
              [checked]="isCategoriaSelected(c)"
              (change)="toggleCategoria(c)"
              color="primary"
            >
              {{ c }}
            </mat-checkbox>
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
              <div class="grid grid-cols-[60px_1fr] items-center gap-2">
                <span
                  class="text-label-caps text-on-surface-variant font-semibold tracking-wider uppercase"
                  >Desde</span
                >
                <app-date-range-picker
                  [value]="fechaDesde()"
                  [min]="fechaMin()"
                  [max]="fechaMax()"
                  ariaLabel="Fecha desde"
                  (dateChange)="setFechaDesde($event)"
                />
              </div>
              <div class="grid grid-cols-[60px_1fr] items-center gap-2">
                <span
                  class="text-label-caps text-on-surface-variant font-semibold tracking-wider uppercase"
                  >Hasta</span
                >
                <app-date-range-picker
                  [value]="fechaHasta()"
                  [min]="fechaMin()"
                  [max]="fechaMax()"
                  ariaLabel="Fecha hasta"
                  (dateChange)="setFechaHasta($event)"
                />
              </div>
            </div>
            <p
              class="text-label-caps text-on-surface-variant mt-2 leading-snug tracking-wider uppercase"
            >
              Aplica a la serie temporal. La granularidad del DW es trimestral.
            </p>
          }
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-1 border-none p-0">
          <legend
            class="text-label-caps text-on-surface-variant mb-2 font-semibold tracking-wider uppercase"
          >
            Restricciones
          </legend>
          <mat-checkbox
            [ngModel]="store.filtros().soloConDisponibilidad"
            (ngModelChange)="store.setSoloConDisponibilidad($event)"
            color="primary"
          >
            Solo con disponibilidad
          </mat-checkbox>
          <mat-checkbox
            [ngModel]="store.filtros().soloConCalificacion"
            (ngModelChange)="store.setSoloConCalificacion($event)"
            color="primary"
          >
            Solo con calificación
          </mat-checkbox>
        </fieldset>

        <button mat-stroked-button class="mt-2 w-full" (click)="store.resetFilters()">
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
  readonly fechaDesde = computed<Date | null>(() => toDate(this.store.filtros().fechaDesde));
  readonly fechaHasta = computed<Date | null>(() => toDate(this.store.filtros().fechaHasta));
  /** Datepicker min/max bounds, converted from the store's ISO strings. */
  readonly fechaMin = computed<Date | null>(() => toDate(this.store.timeRangeBounds().min));
  readonly fechaMax = computed<Date | null>(() => toDate(this.store.timeRangeBounds().max));

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
   * Date-range handlers for the "Rango de fechas" fieldset.
   * Null date → null (treated as "no bound" by the store).
   */
  setFechaDesde(value: Date | null): void {
    this.store.setFechaRange(fromDate(value), this.store.filtros().fechaHasta);
  }
  setFechaHasta(value: Date | null): void {
    this.store.setFechaRange(this.store.filtros().fechaDesde, fromDate(value));
  }
}
