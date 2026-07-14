import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/dashboard.store';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../shared/chart-card/chart-card.component';

/**
 * Resumen page — top-level executive dashboard.
 *
 * Layout: dense grid of KPI cards on top, then 6 chart cards in a
 * 12-column responsive grid. Each card inherits the same dark glass
 * surface as the rest of the dashboard.
 *
 * Charts shown (in order):
 *   1. Distribución por fuente       (horizontal bars)
 *   2. Top categorías               (horizontal bars)
 *   3. Serie temporal de precios    (sparkline columns)
 *   4. Top productos outlier        (list with prices)
 *   5. Precio vs categorías x fuente(horizontal bars)
 *   6. Distribución percentiles     (dot scale)
 *
 * Data sources (only signals populated by `DashboardStore.initialize`):
 *   - resumen.tablas    → KPIs
 *   - kpis.*            → preferencia, completitud
 *   - preguntaPrincipal → fuente × categoria prices
 *   - outliers          → outlier product list
 *   - timeSeries        → serie temporal
 */
@Component({
  selector: 'app-resumen-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardComponent, ChartCardComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Resumen ejecutivo</h1>
        <p class="page-sub">
          KPIs principales + vista de distribución del data warehouse.
        </p>
      </div>
      @if (store.isSnapshot()) {
        <div class="snapshot-pill" role="status">
          <span class="snapshot-pill__dot"></span>
          <span>Snapshot · {{ store.snapshotDate() }}</span>
        </div>
      }
    </header>

    <!-- ─── KPIs top row ───────────────────────────────────── -->
    <section class="kpi-grid" aria-label="7 KPIs principales">
      <app-kpi-card
        label="Total productos"
        [value]="totalProductos()"
        icon="📦"
        accent="#60a5fa"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Total encuestas"
        [value]="totalEncuestas()"
        icon="📋"
        accent="#34d399"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Precio promedio"
        [value]="precioPromedio()"
        delta="USD por producto"
        icon="💰"
        accent="#fbbf24"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Fuentes scrapeadas"
        [value]="fuentesScrapeadas()"
        icon="🌐"
        accent="#a78bfa"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Categorías únicas"
        [value]="categoriasUnicas()"
        icon="🏷️"
        accent="#f472b6"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Completitud"
        [value]="completitudGeneral()"
        delta="ficha completa"
        icon="✅"
        accent="#34d399"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Preferencia top"
        [value]="preferenciaTop()"
        [delta]="preferenciaPct()"
        icon="🏆"
        accent="#fb923c"
        [loading]="store.loading()"
      />
    </section>

    <!-- ─── Charts grid ────────────────────────────────────── -->
    <section class="charts-grid" aria-label="Distribuciones principales">

      <app-chart-card
        title="Distribución por fuente"
        caption="Productos por fuente scrapeada"
        class="charts-grid__span-6"
      >
        @if (fuentesDist().length > 0) {
          <ul class="bars-list bars-list--horizontal">
            @for (f of fuentesDist(); track f.label) {
              <li class="bars-list__row">
                <span class="bars-list__label">{{ f.label }}</span>
                <div class="bars-list__track">
                  <span
                    class="bars-list__fill"
                    [style.width.%]="f.pct"
                    [style.background]="f.color"
                  ></span>
                </div>
                <span class="bars-list__value">{{ f.value }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-state">Sin datos de fuentes</div>
        }
      </app-chart-card>

      <app-chart-card
        title="Top categorías"
        caption="Categorías con más productos"
        class="charts-grid__span-6"
      >
        @if (categoriasDist().length > 0) {
          <ul class="bars-list bars-list--horizontal">
            @for (c of categoriasDist(); track c.label) {
              <li class="bars-list__row">
                <span class="bars-list__label">{{ c.label }}</span>
                <div class="bars-list__track">
                  <span
                    class="bars-list__fill"
                    [style.width.%]="c.pct"
                    [style.background]="c.color"
                  ></span>
                </div>
                <span class="bars-list__value">{{ c.value }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-state">Sin datos de categorías</div>
        }
      </app-chart-card>

      <app-chart-card
        title="Serie temporal de precios"
        caption="Precio promedio por trimestre × fuente"
        class="charts-grid__span-8"
      >
        @if (serieTemporal().length > 0) {
          <div class="sparkline">
            @for (p of serieTemporal(); track p.label) {
              <div class="sparkline__col" [style.height.%]="p.pct">
                <span class="sparkline__val">{{ '$' + p.value }}</span>
                <span class="sparkline__label">{{ p.label }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">Sin serie temporal</div>
        }
      </app-chart-card>

      <app-chart-card
        title="Outliers detectados"
        caption="Productos fuera de rango IQR"
        class="charts-grid__span-4"
      >
        @if (outlierTop().length > 0) {
          <ul class="ranked-list">
            @for (o of outlierTop(); track o.label) {
              <li class="ranked-list__row">
                <span class="ranked-list__source">{{ o.fuente }}</span>
                <span class="ranked-list__product">{{ o.label }}</span>
                <span class="ranked-list__price">{{ '$' + o.value }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-state">Sin outliers</div>
        }
      </app-chart-card>

      <app-chart-card
        title="Productos por fuente × categoría"
        caption="Distribución agregada"
        class="charts-grid__span-6"
      >
        @if (fuenteCategoria().length > 0) {
          <ul class="bars-list bars-list--horizontal">
            @for (r of fuenteCategoria(); track r.label) {
              <li class="bars-list__row">
                <span class="bars-list__label">{{ r.label }}</span>
                <div class="bars-list__track">
                  <span
                    class="bars-list__fill"
                    [style.width.%]="r.pct"
                    [style.background]="r.color"
                  ></span>
                </div>
                <span class="bars-list__value">{{ r.value }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-state">Sin datos</div>
        }
      </app-chart-card>

      <app-chart-card
        title="Precio promedio por fuente"
        caption="Promedio USD × fuente"
        class="charts-grid__span-6"
      >
        @if (precioPorFuente().length > 0) {
          <ul class="bars-list bars-list--horizontal">
            @for (p of precioPorFuente(); track p.label) {
              <li class="bars-list__row">
                <span class="bars-list__label">{{ p.label }}</span>
                <div class="bars-list__track">
                  <span
                    class="bars-list__fill"
                    [style.width.%]="p.pct"
                    [style.background]="p.color"
                  ></span>
                </div>
                <span class="bars-list__value">{{ '$' + p.value }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-state">Sin datos</div>
        }
      </app-chart-card>
    </section>

    @if (store.error()) {
      <div class="error-banner" role="alert">
        <strong>Error al cargar el resumen:</strong> {{ store.error() }}
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ─── Header ──────────────────────────────────────── */
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 0 1.5rem;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .page-header h1 {
        margin: 0 0 0.25rem;
        font-size: 1.875rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--text-1);
      }

      .page-sub {
        margin: 0;
        color: var(--text-3);
        font-size: 0.875rem;
      }

      .snapshot-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
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

      /* ─── KPI grid ───────────────────────────────────── */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      /* ─── Charts grid (12-col responsive) ────────────── */
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 1rem;
      }

      .charts-grid__span-4 { grid-column: span 12; }
      .charts-grid__span-6 { grid-column: span 12; }
      .charts-grid__span-8 { grid-column: span 12; }

      @media (min-width: 900px) {
        .charts-grid__span-6 { grid-column: span 6; }
        .charts-grid__span-4 { grid-column: span 4; }
        .charts-grid__span-8 { grid-column: span 8; }
      }

      /* ─── Horizontal bars ───────────────────────────── */
      .bars-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .bars-list__row {
        display: grid;
        grid-template-columns: 130px 1fr 60px;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.8125rem;
      }

      .bars-list__label {
        color: var(--text-2);
        font-weight: 500;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bars-list__track {
        height: 8px;
        background: var(--surface-2);
        border-radius: 999px;
        overflow: hidden;
        position: relative;
      }

      .bars-list__fill {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: 999px;
        background: var(--accent);
        transition: width 0.4s ease;
      }

      .bars-list__value {
        color: var(--text-1);
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }

      /* ─── Sparkline (serie temporal) ─────────────────── */
      .sparkline {
        display: flex;
        align-items: flex-end;
        gap: 0.5rem;
        height: 100%;
        min-height: 200px;
      }

      .sparkline__col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
        min-width: 0;
        background: var(--accent-dim);
        border-radius: 6px 6px 0 0;
        position: relative;
        min-height: 24px;
        border: 1px solid var(--accent-border);
        border-bottom: none;
      }

      .sparkline__val {
        position: absolute;
        top: -1.5rem;
        left: 50%;
        transform: translateX(-50%);
        color: var(--text-1);
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      .sparkline__label {
        position: absolute;
        bottom: -1.5rem;
        left: 50%;
        transform: translateX(-50%);
        color: var(--text-3);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
        white-space: nowrap;
      }

      /* ─── Outliers list ──────────────────────────────── */
      .ranked-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .ranked-list__row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        padding: 0.5rem 0.625rem;
        border-radius: 6px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-size: 0.8125rem;
        align-items: center;
      }

      .ranked-list__source {
        grid-column: 1 / -1;
        color: var(--accent);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
      }

      .ranked-list__product {
        color: var(--text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 180px;
      }

      .ranked-list__price {
        color: var(--text-1);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      /* ─── Empty state ────────────────────────────────── */
      .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        color: var(--text-4);
        font-size: 0.8125rem;
        font-style: italic;
      }

      /* ─── Error banner ───────────────────────────────── */
      .error-banner {
        margin-top: 1.5rem;
        background: var(--danger-dim);
        border: 1px solid var(--danger);
        border-color: color-mix(in srgb, var(--danger) 40%, transparent);
        color: var(--danger);
        padding: 0.75rem 1rem;
        border-radius: 8px;
      }
    `,
  ],
})
export class ResumenPage {
  readonly store = inject(DashboardStore);

  private static readonly SOURCE_COLORS = [
    'linear-gradient(90deg, #60a5fa 0%, #818cf8 100%)',
    'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
    'linear-gradient(90deg, #fbbf24 0%, #fb923c 100%)',
    'linear-gradient(90deg, #f472b6 0%, #c084fc 100%)',
    'linear-gradient(90deg, #a78bfa 0%, #818cf8 100%)',
    'linear-gradient(90deg, #22d3ee 0%, #60a5fa 100%)',
    'linear-gradient(90deg, #fb7185 0%, #fb923c 100%)',
  ];

  // ─── KPIs ──────────────────────────────────────────────

  readonly totalProductos = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'fact_productos');
    return row?.registros ?? '—';
  });

  readonly totalEncuestas = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'fact_encuesta_consumo');
    return row?.registros ?? '—';
  });

  readonly precioPromedio = computed<string>(() => {
    const rows = this.store.preguntaPrincipal();
    if (!rows.length) return '—';
    const avg =
      rows.reduce((acc, r) => acc + r.precio_promedio_usd, 0) / rows.length;
    return `$${avg.toFixed(2)}`;
  });

  readonly fuentesScrapeadas = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'dim_fuente');
    return row?.registros ?? '—';
  });

  readonly categoriasUnicas = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'dim_categoria');
    return row?.registros ?? '—';
  });

  readonly completitudGeneral = computed<string>(() => {
    const k = this.store.kpis();
    const first = k?.completitud?.[0];
    if (!first) return '—';
    return `${first.pct_ficha_completa.toFixed(1)}%`;
  });

  readonly preferenciaTop = computed<string>(() => {
    const k = this.store.kpis();
    if (!k?.preferencia?.length) return '—';
    const sorted = [...k.preferencia].sort(
      (a, b) => b.pct_preferencia - a.pct_preferencia,
    );
    return sorted[0].plataforma;
  });

  readonly preferenciaPct = computed<string>(() => {
    const k = this.store.kpis();
    if (!k?.preferencia?.length) return '';
    const sorted = [...k.preferencia].sort(
      (a, b) => b.pct_preferencia - a.pct_preferencia,
    );
    return `${sorted[0].pct_preferencia.toFixed(1)}% de preferencia`;
  });

  // ─── Chart data ────────────────────────────────────────

  /** Distribución de productos por fuente (top 7). */
  readonly fuentesDist = computed(() => {
    const rows = this.store.preguntaPrincipal();
    if (!rows.length) return [];
    const byFuente = new Map<string, number>();
    for (const r of rows) {
      byFuente.set(r.fuente, (byFuente.get(r.fuente) ?? 0) + r.total_productos);
    }
    const sorted = [...byFuente.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([label, value], i) => ({
      label,
      value,
      pct: (value / max) * 100,
      color: ResumenPage.SOURCE_COLORS[i % ResumenPage.SOURCE_COLORS.length],
    }));
  });

  /** Distribución de productos por categoría (top 7). */
  readonly categoriasDist = computed(() => {
    const rows = this.store.preguntaPrincipal();
    if (!rows.length) return [];
    const byCat = new Map<string, number>();
    for (const r of rows) {
      byCat.set(r.categoria, (byCat.get(r.categoria) ?? 0) + r.total_productos);
    }
    const sorted = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([label, value], i) => ({
      label,
      value,
      pct: (value / max) * 100,
      color: ResumenPage.SOURCE_COLORS[i % ResumenPage.SOURCE_COLORS.length],
    }));
  });

  /** Serie temporal quarterly (top 8 trimestres). */
  readonly serieTemporal = computed(() => {
    const ts = this.store.timeSeries();
    if (!ts?.length) return [];
    const sorted = [...ts]
      .sort((a, b) => a.anio - b.anio || a.trimestre - b.trimestre)
      .slice(0, 8);
    const max = Math.max(...sorted.map((r) => r.precio_promedio), 1);
    const min = Math.min(...sorted.map((r) => r.precio_promedio), 0);
    const range = max - min || 1;
    return sorted.map((r) => ({
      label: `Q${r.trimestre}`,
      value: r.precio_promedio.toFixed(0),
      pct: ((r.precio_promedio - min) / range) * 70 + 30,
    }));
  });

  /** Top outliers (top 6). */
  readonly outlierTop = computed(() => {
    const rows = this.store.outliers();
    if (!rows?.length) return [];
    const sorted = [...rows]
      .sort((a, b) => b.precio_usd - a.precio_usd)
      .slice(0, 6);
    return sorted.map((o) => ({
      fuente: o.fuente,
      label: o.producto?.slice(0, 38) ?? '—',
      value: o.precio_usd.toFixed(0),
    }));
  });

  /** Top combos fuente × categoría por # productos (top 6). */
  readonly fuenteCategoria = computed(() => {
    const rows = this.store.preguntaPrincipal();
    if (!rows.length) return [];
    const sorted = [...rows]
      .sort((a, b) => b.total_productos - a.total_productos)
      .slice(0, 6);
    const max = sorted[0]?.total_productos ?? 1;
    return sorted.map((r, i) => ({
      label: `${r.fuente} → ${r.categoria}`,
      value: r.total_productos,
      pct: (r.total_productos / max) * 100,
      color: ResumenPage.SOURCE_COLORS[i % ResumenPage.SOURCE_COLORS.length],
    }));
  });

  /** Precio promedio por fuente. */
  readonly precioPorFuente = computed(() => {
    const rows = this.store.preguntaPrincipal();
    if (!rows.length) return [];
    const byFuente = new Map<string, { total: number; count: number }>();
    for (const r of rows) {
      const existing = byFuente.get(r.fuente) ?? { total: 0, count: 0 };
      existing.total += r.precio_promedio_usd;
      existing.count += 1;
      byFuente.set(r.fuente, existing);
    }
    const items = [...byFuente.entries()].map(([label, { total, count }]) => ({
      label,
      value: (total / count).toFixed(2),
      avg: total / count,
    }));
    const sorted = items.sort((a, b) => b.avg - a.avg).slice(0, 7);
    const max = Math.max(...sorted.map((s) => Number(s.value)), 1);
    return sorted.map((s, i) => ({
      label: s.label,
      value: s.value,
      pct: (Number(s.value) / max) * 100,
      color: ResumenPage.SOURCE_COLORS[i % ResumenPage.SOURCE_COLORS.length],
    }));
  });
}
