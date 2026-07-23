import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/dashboard.store';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../shared/chart-card/chart-card.component';

/**
 * Resumen page — top-level executive dashboard.
 *
 * Layout: dense grid of KPI cards on top, then 6 chart cards in a
 * 12-column responsive grid. Each card inherits the same Insight
 * Flow surface as the rest of the dashboard.
 *
 * Charts shown (in order):
 *   1. Distribución por fuente       (horizontal bars)
 *   2. Top categorías               (horizontal bars)
 *   3. Serie temporal de precios    (sparkline columns)
 *   4. Top productos outlier        (list with prices)
 *   5. Precio vs categorías x fuente(horizontal bars)
 *   6. Distribución percentiles     (dot scale)
 *
 * Sprint 6: tokens migrated to Insight Flow (Material 3 + Tailwind
 * v4). KPI icons switched from emoji to Material Symbols names.
 * The chart gradients (SOURCE_COLORS) stay as literal CSS values
 * because the bars use them as inline [style.background] — they
 * are data attributes, not design tokens.
 */
@Component({
  selector: 'app-resumen-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardComponent, ChartCardComponent],
  template: `
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-headline-lg text-on-surface m-0 mb-1 font-bold tracking-tight">
          Resumen ejecutivo
        </h1>
        <p class="text-body-md text-on-surface-variant m-0">
          KPIs principales + vista de distribución del data warehouse.
        </p>
      </div>
      @if (store.isSnapshot()) {
        <div
          class="inline-flex items-center gap-2 rounded-full border bg-warning-dim px-3 py-1.5 text-label-caps font-semibold text-warning"
          style="border-color: color-mix(in srgb, var(--color-warning) 40%, transparent)"
          role="status"
        >
          <span
            class="h-1.5 w-1.5 rounded-full bg-warning"
            style="box-shadow: 0 0 8px var(--color-warning)"
          ></span>
          <span>Snapshot · {{ store.snapshotDate() }}</span>
        </div>
      }
    </header>

    <!-- ─── KPIs top row ───────────────────────────────────── -->
    <section
      class="mb-8 grid gap-4"
      style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))"
      aria-label="7 KPIs principales"
    >
      <app-kpi-card
        label="Total productos"
        [value]="totalProductos()"
        icon="inventory_2"
        accent="secondary"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Total encuestas"
        [value]="totalEncuestas()"
        icon="fact_check"
        accent="success"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Precio promedio"
        [value]="precioPromedio()"
        delta="USD por producto"
        icon="payments"
        accent="warning"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Fuentes scrapeadas"
        [value]="fuentesScrapeadas()"
        icon="public"
        accent="secondary"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Categorías únicas"
        [value]="categoriasUnicas()"
        icon="sell"
        accent="primary"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Completitud"
        [value]="completitudGeneral()"
        delta="ficha completa"
        icon="verified"
        accent="success"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Preferencia top"
        [value]="preferenciaTop()"
        [delta]="preferenciaPct()"
        icon="emoji_events"
        accent="warning"
        [loading]="store.loading()"
      />
    </section>

    <!-- ─── Charts grid ────────────────────────────────────── -->
    <section
      class="grid gap-4"
      style="grid-template-columns: repeat(12, 1fr)"
      aria-label="Distribuciones principales"
    >
      <div class="col-span-12 md:col-span-6">
        <app-chart-card title="Distribución por fuente" caption="Productos por fuente scrapeada">
          @if (fuentesDist().length > 0) {
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (f of fuentesDist(); track f.label) {
                <li
                  class="grid items-center gap-3 text-body-md"
                  style="grid-template-columns: 130px 1fr 60px"
                >
                  <span
                    class="text-on-surface-variant overflow-hidden text-right text-ellipsis whitespace-nowrap font-medium"
                    >{{ f.label }}</span
                  >
                  <div class="relative h-2 overflow-hidden rounded-full bg-surface-container-low">
                    <span
                      class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-400"
                      [style.width.%]="f.pct"
                      [style.background]="f.color"
                    ></span>
                  </div>
                  <span class="text-on-surface text-right font-semibold tabular-nums">{{
                    f.value
                  }}</span>
                </li>
              }
            </ul>
          } @else {
            <div
              class="text-on-surface-variant flex min-h-50 items-center justify-center text-body-md italic"
            >
              Sin datos de fuentes
            </div>
          }
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-6">
        <app-chart-card title="Top categorías" caption="Categorías con más productos">
          @if (categoriasDist().length > 0) {
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (c of categoriasDist(); track c.label) {
                <li
                  class="grid items-center gap-3 text-body-md"
                  style="grid-template-columns: 130px 1fr 60px"
                >
                  <span
                    class="text-on-surface-variant overflow-hidden text-right text-ellipsis whitespace-nowrap font-medium"
                    >{{ c.label }}</span
                  >
                  <div class="relative h-2 overflow-hidden rounded-full bg-surface-container-low">
                    <span
                      class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-400"
                      [style.width.%]="c.pct"
                      [style.background]="c.color"
                    ></span>
                  </div>
                  <span class="text-on-surface text-right font-semibold tabular-nums">{{
                    c.value
                  }}</span>
                </li>
              }
            </ul>
          } @else {
            <div
              class="text-on-surface-variant flex min-h-50 items-center justify-center text-body-md italic"
            >
              Sin datos de categorías
            </div>
          }
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-8">
        <app-chart-card
          title="Serie temporal de precios"
          caption="Precio promedio por trimestre × fuente"
        >
          @if (serieTemporal().length > 0) {
            <div class="flex min-h-50 items-end gap-2">
              @for (p of serieTemporal(); track p.label) {
                <div
                  class="relative flex min-h-6 min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-t-md border border-primary bg-primary-fixed"
                  [style.height.%]="p.pct"
                >
                  <span
                    class="text-on-surface absolute -top-6 left-1/2 -translate-x-1/2 text-body-md font-semibold whitespace-nowrap tabular-nums"
                    >{{ '$' + p.value }}</span
                  >
                  <span
                    class="text-on-surface-variant absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
                    >{{ p.label }}</span
                  >
                </div>
              }
            </div>
          } @else {
            <div
              class="text-on-surface-variant flex min-h-50 items-center justify-center text-body-md italic"
            >
              Sin serie temporal
            </div>
          }
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-4">
        <app-chart-card title="Outliers detectados" caption="Productos fuera de rango IQR">
          @if (outlierTop().length > 0) {
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
              @for (o of outlierTop(); track o.label) {
                <li
                  class="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-outline-variant bg-surface-container-low p-2 text-body-md"
                >
                  <span
                    class="text-label-caps text-primary col-span-full font-semibold tracking-wider uppercase"
                    >{{ o.fuente }}</span
                  >
                  <span
                    class="text-on-surface-variant max-w-45 overflow-hidden text-ellipsis whitespace-nowrap"
                    >{{ o.label }}</span
                  >
                  <span class="text-on-surface font-bold tabular-nums">{{ '$' + o.value }}</span>
                </li>
              }
            </ul>
          } @else {
            <div
              class="text-on-surface-variant flex min-h-50 items-center justify-center text-body-md italic"
            >
              Sin outliers
            </div>
          }
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-6">
        <app-chart-card title="Productos por fuente × categoría" caption="Distribución agregada">
          @if (fuenteCategoria().length > 0) {
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (r of fuenteCategoria(); track r.label) {
                <li
                  class="grid items-center gap-3 text-body-md"
                  style="grid-template-columns: 130px 1fr 60px"
                >
                  <span
                    class="text-on-surface-variant overflow-hidden text-right text-ellipsis whitespace-nowrap font-medium"
                    >{{ r.label }}</span
                  >
                  <div class="relative h-2 overflow-hidden rounded-full bg-surface-container-low">
                    <span
                      class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-400"
                      [style.width.%]="r.pct"
                      [style.background]="r.color"
                    ></span>
                  </div>
                  <span class="text-on-surface text-right font-semibold tabular-nums">{{
                    r.value
                  }}</span>
                </li>
              }
            </ul>
          } @else {
            <div
              class="text-on-surface-variant flex min-h-50 items-center justify-center text-body-md italic"
            >
              Sin datos
            </div>
          }
        </app-chart-card>
      </div>

      <div class="col-span-12 md:col-span-6">
        <app-chart-card title="Precio promedio por fuente" caption="Promedio USD × fuente">
          @if (precioPorFuente().length > 0) {
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (p of precioPorFuente(); track p.label) {
                <li
                  class="grid items-center gap-3 text-body-md"
                  style="grid-template-columns: 130px 1fr 60px"
                >
                  <span
                    class="text-on-surface-variant overflow-hidden text-right text-ellipsis whitespace-nowrap font-medium"
                    >{{ p.label }}</span
                  >
                  <div class="relative h-2 overflow-hidden rounded-full bg-surface-container-low">
                    <span
                      class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-400"
                      [style.width.%]="p.pct"
                      [style.background]="p.color"
                    ></span>
                  </div>
                  <span class="text-on-surface text-right font-semibold tabular-nums">{{
                    '$' + p.value
                  }}</span>
                </li>
              }
            </ul>
          } @else {
            <div
              class="text-on-surface-variant flex min-h-50 items-center justify-center text-body-md italic"
            >
              Sin datos
            </div>
          }
        </app-chart-card>
      </div>
    </section>

    @if (store.error()) {
      <div
        class="mt-6 rounded-md border bg-danger-dim p-4 text-body-md text-danger"
        style="border-color: color-mix(in srgb, var(--color-danger) 40%, transparent)"
        role="alert"
      >
        <strong>Error al cargar el resumen:</strong> {{ store.error() }}
      </div>
    }
  `,
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
    const avg = rows.reduce((acc, r) => acc + r.precio_promedio_usd, 0) / rows.length;
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
    const sorted = [...k.preferencia].sort((a, b) => b.pct_preferencia - a.pct_preferencia);
    return sorted[0].plataforma;
  });

  readonly preferenciaPct = computed<string>(() => {
    const k = this.store.kpis();
    if (!k?.preferencia?.length) return '';
    const sorted = [...k.preferencia].sort((a, b) => b.pct_preferencia - a.pct_preferencia);
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
    const sorted = [...byFuente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
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
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
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
    const sorted = [...ts].sort((a, b) => a.anio - b.anio || a.trimestre - b.trimestre).slice(0, 8);
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
    const sorted = [...rows].sort((a, b) => b.precio_usd - a.precio_usd).slice(0, 6);
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
    const sorted = [...rows].sort((a, b) => b.total_productos - a.total_productos).slice(0, 6);
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
