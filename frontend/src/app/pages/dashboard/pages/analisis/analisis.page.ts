import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
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
 *           (driven by `getPreguntaPrincipal`).
 * Family 2: line chart of precio promedio por trimestre × fuente with
 *           a prominent "snapshot de UN SOLO DÍA" banner.
 * Family 3: scatter using `getOutliers`.
 * Family 4: box plot por fuente.
 *
 * The filter inputs drive a `computed()` derivation that recomputes
 * every chart's series array whenever any filter changes. Because the
 * underlying data is small (168 products / 24 surveys) we filter
 * client-side rather than re-hitting the backend — this keeps the
 * UI snappy and avoids the round-trip latency that would dominate
 * over the actual render time.
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
    <header class="page-header">
      <h1>Análisis de precios</h1>
      <p class="page-sub">
        4 familias de gráficos con filtros reactivos. Cambiá un filtro y los
        gráficos se recalculan automáticamente.
      </p>
    </header>

    @if (store.isSnapshot()) {
      <div class="snapshot-pill" role="status">
        <span class="snapshot-pill__dot"></span>
        <span>
          Serie temporal · <strong>UN SOLO DÍA</strong> ({{ store.snapshotDate() }}).
          La línea es representativa del snapshot, no de una tendencia real.
        </span>
      </div>
    }

    <div class="analisis-layout">
      <aside class="filter-sidebar" aria-label="Filtros globales">
        <h3>Filtros</h3>

        <fieldset class="filter-group">
          <legend>Fuentes</legend>
          @for (f of availableFuentes(); track f) {
            <label class="filter-check">
              <input
                type="checkbox"
                [checked]="isFuenteSelected(f)"
                (change)="toggleFuente(f)"
              />
              <span>{{ f }}</span>
            </label>
          }
        </fieldset>

        <fieldset class="filter-group">
          <legend>Categorías</legend>
          @if (availableCategorias().length === 0) {
            <p class="filter-empty">Cargando categorías…</p>
          }
          @for (c of availableCategorias(); track c) {
            <label class="filter-check">
              <input
                type="checkbox"
                [checked]="isCategoriaSelected(c)"
                (change)="toggleCategoria(c)"
              />
              <span>{{ c }}</span>
            </label>
          }
        </fieldset>

        <fieldset class="filter-group">
          <legend>Rango de precio (USD)</legend>
          <div class="range-row">
            <input
              type="number"
              min="0"
              step="1"
              [ngModel]="rangoMin()"
              (ngModelChange)="setRangoMin($event)"
              aria-label="Precio mínimo"
            />
            <span>—</span>
            <input
              type="number"
              min="0"
              step="1"
              [ngModel]="rangoMax()"
              (ngModelChange)="setRangoMax($event)"
              aria-label="Precio máximo"
            />
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Rango de fechas</legend>
          @if (!store.timeRangeIsApplicable()) {
            <p class="filter-empty" role="note">
              El DW es un snapshot de un solo día
              @if (store.timeRangeBounds().min) {
                ({{ store.timeRangeBounds().min }})
              }.
              El filtro temporal se activa cuando hay más de una fecha
              capturada en <code>dim_tiempo</code>.
            </p>
          } @else {
            <div class="date-row">
              <label class="filter-check">
                <span class="date-label">Desde</span>
                <input
                  type="date"
                  [min]="store.timeRangeBounds().min"
                  [max]="store.timeRangeBounds().max"
                  [value]="fechaDesde() ?? ''"
                  (change)="setFechaDesde($event)"
                  [attr.aria-label]="'Fecha desde'"
                />
              </label>
              <label class="filter-check">
                <span class="date-label">Hasta</span>
                <input
                  type="date"
                  [min]="store.timeRangeBounds().min"
                  [max]="store.timeRangeBounds().max"
                  [value]="fechaHasta() ?? ''"
                  (change)="setFechaHasta($event)"
                  [attr.aria-label]="'Fecha hasta'"
                />
              </label>
            </div>
            <p class="filter-help">
              Aplica a la serie temporal. La granularidad del DW es
              trimestral.
            </p>
          }
        </fieldset>

        <fieldset class="filter-group">
          <legend>Restricciones</legend>
          <label class="filter-check">
            <input
              type="checkbox"
              [ngModel]="store.filtros().soloConDisponibilidad"
              (ngModelChange)="store.setSoloConDisponibilidad($event)"
            />
            <span>Solo con disponibilidad</span>
          </label>
          <label class="filter-check">
            <input
              type="checkbox"
              [ngModel]="store.filtros().soloConCalificacion"
              (ngModelChange)="store.setSoloConCalificacion($event)"
            />
            <span>Solo con calificación</span>
          </label>
        </fieldset>

        <button type="button" class="reset-btn" (click)="store.resetFilters()">
          Limpiar filtros
        </button>
      </aside>

      <section class="charts-grid charts-grid--analisis">
        <app-chart-card
          title="Barras correlacionales"
          caption="Precio promedio por fuente × categoría"
          class="charts-grid__span-12"
        >
          <app-precio-promedio-fuente-categoria-chart
            [rows]="store.filteredPreguntaPrincipal()"
            [colors]="palette"
          />
        </app-chart-card>

        <app-chart-card
          title="Serie temporal"
          caption="Precio promedio por trimestre"
          class="charts-grid__span-12"
        >
          <app-serie-temporal-precios-chart
            [rows]="store.filteredTimeSeries()"
            [colors]="palette"
            [isSnapshot]="store.isSnapshot()"
            [snapshotDate]="store.snapshotDate()"
          />
        </app-chart-card>

        <app-chart-card
          title="Dispersión de outliers (IQR)"
          caption="Precio por producto coloreado por clasificación"
          class="charts-grid__span-6"
        >
          <app-dispersion-outliers-chart
            [rows]="store.filteredOutliers()"
            [colors]="['#10b981', '#ef4444', '#f59e0b']"
          />
        </app-chart-card>

        <app-chart-card
          title="Box plot por fuente"
          caption="Distribución del rango de precios detectado como outlier"
          class="charts-grid__span-6"
        >
          <app-boxplot-por-fuente-chart
            [rows]="store.filteredOutliers()"
            [colors]="palette"
          />
        </app-chart-card>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-header h1 {
        margin: 0 0 0.25rem;
        font-size: 1.875rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--text-1);
      }
      .page-sub {
        margin: 0 0 1.5rem;
        color: var(--text-3);
        font-size: 0.875rem;
      }
      .snapshot-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        padding: 0.375rem 0.75rem;
        border-radius: 999px;
        background: var(--warning-dim);
        border: 1px solid var(--warning);
        border-color: color-mix(in srgb, var(--warning) 40%, transparent);
        color: var(--warning);
        font-size: 0.75rem;
        font-weight: 600;
      }
      .snapshot-pill__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--warning);
        box-shadow: 0 0 8px var(--warning);
      }
      .analisis-layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 1.5rem;
        align-items: start;
      }
      @media (max-width: 900px) {
        .analisis-layout {
          grid-template-columns: 1fr;
        }
      }
      .filter-sidebar {
        background: var(--surface);
        background-image: var(--card-glass, none);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        position: sticky;
        top: 1rem;
        font-family: var(--font);
      }
      .filter-sidebar h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-1);
        letter-spacing: -0.01em;
      }
      .filter-group {
        border: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .filter-group legend {
        font-size: 0.6875rem;
        text-transform: uppercase;
        color: var(--text-3);
        font-weight: 600;
        letter-spacing: 0.08em;
        margin-bottom: 0.5rem;
      }
      .filter-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--text-2);
        cursor: pointer;
        padding: 0.25rem 0;
      }
      .filter-check:hover {
        color: var(--text-1);
      }
      .filter-empty {
        font-size: 0.75rem;
        color: var(--text-4);
        margin: 0;
        font-style: italic;
      }
      .range-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .range-row input {
        width: 90px;
        padding: 0.375rem 0.5rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 0.8125rem;
        color: var(--text-1);
        font-family: inherit;
      }
      .range-row input:focus {
        outline: none;
        border-color: var(--accent);
      }
      .date-row {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .date-row .filter-check {
        display: grid;
        grid-template-columns: 60px 1fr;
        align-items: center;
        gap: 0.5rem;
      }
      .date-row input[type='date'] {
        padding: 0.375rem 0.5rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 0.8125rem;
        color: var(--text-1);
        font-family: inherit;
        color-scheme: dark;
      }
      .date-row input[type='date']:focus {
        outline: none;
        border-color: var(--accent);
      }
      .date-label {
        font-size: 0.75rem;
        color: var(--text-3);
        font-weight: 600;
      }
      .filter-help {
        margin: 0.5rem 0 0;
        font-size: 0.6875rem;
        color: var(--text-4);
        line-height: 1.4;
      }
      .filter-help code {
        background: var(--surface-2);
        padding: 0.0625rem 0.25rem;
        border-radius: 3px;
        font-family: var(--font-mono, monospace);
        font-size: 0.6875rem;
      }
      .reset-btn {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 0.8125rem;
        cursor: pointer;
        color: var(--text-3);
        font-weight: 600;
      }
      .reset-btn:hover {
        background: var(--accent-dim);
        color: var(--text-1);
      }
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 1rem;
      }

      .charts-grid__span-12 { grid-column: span 12; }
      .charts-grid__span-6 { grid-column: span 12; }

      @media (min-width: 900px) {
        .charts-grid__span-6 { grid-column: span 6; }
      }
    `,
  ],
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
   *
   * The native `<input type="date">` fires `(change)` with `event.target.value`
   * already in ISO-8601 (`YYYY-MM-DD`), which is exactly the shape the store
   * expects. Empty string → null (treated as "no bound").
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