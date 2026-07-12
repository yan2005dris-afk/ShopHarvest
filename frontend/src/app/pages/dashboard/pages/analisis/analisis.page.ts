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
      <div class="snapshot-banner" role="status">
        <span class="snapshot-banner__icon" aria-hidden="true">⚠️</span>
        <span>
          Serie temporal con <strong>UN SOLO DÍA</strong> de datos
          ({{ store.snapshotDate() }}). La línea es representativa del snapshot, no de
          una tendencia temporal real.
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

      <section class="charts">
        <article class="chart-card">
          <header class="chart-card__header">
            <h2>1 · Barras correlacionales</h2>
            <p>Precio promedio por fuente × categoría</p>
          </header>
          <app-precio-promedio-fuente-categoria-chart
            [rows]="store.filteredPreguntaPrincipal()"
            [colors]="palette"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <h2>2 · Serie temporal</h2>
            <p>Precio promedio por trimestre (snapshot)</p>
          </header>
          <app-serie-temporal-precios-chart
            [rows]="store.filteredTimeSeries()"
            [colors]="palette"
            [isSnapshot]="store.isSnapshot()"
            [snapshotDate]="store.snapshotDate()"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <h2>3 · Dispersión de outliers (IQR)</h2>
            <p>Precio por producto coloreado por clasificación</p>
          </header>
          <app-dispersion-outliers-chart
            [rows]="store.filteredOutliers()"
            [colors]="['#10b981', '#ef4444', '#f59e0b']"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <h2>4 · Box plot por fuente</h2>
            <p>Distribución del rango de precios detectado como outlier</p>
          </header>
          <app-boxplot-por-fuente-chart
            [rows]="store.filteredOutliers()"
            [colors]="palette"
          />
        </article>
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
        font-size: 1.75rem;
        color: #111827;
      }
      .page-sub {
        margin: 0 0 1.5rem;
        color: #6b7280;
      }
      .snapshot-banner {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        font-size: 0.9rem;
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
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        position: sticky;
        top: 1rem;
      }
      .filter-sidebar h3 {
        margin: 0;
        font-size: 1rem;
        color: #111827;
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
        font-size: 0.75rem;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .filter-check {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: #374151;
      }
      .filter-empty {
        font-size: 0.8rem;
        color: #9ca3af;
        margin: 0;
      }
      .range-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .range-row input {
        width: 90px;
        padding: 0.25rem 0.4rem;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 0.85rem;
      }
      .reset-btn {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.85rem;
        cursor: pointer;
        color: #374151;
      }
      .reset-btn:hover {
        background: #e5e7eb;
      }
      .charts {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .chart-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.25rem;
      }
      .chart-card__header h2 {
        font-size: 1.1rem;
        margin: 0 0 0.25rem;
        color: #111827;
      }
      .chart-card__header p {
        font-size: 0.85rem;
        color: #6b7280;
        margin: 0 0 1rem;
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
}