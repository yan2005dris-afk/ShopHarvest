import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/dashboard.store';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';

/**
 * Resumen page — 7 headline KPI cards.
 *
 * Cards source (with their backing endpoint):
 *   1. Total productos en DW        → summary.tablas (fact_productos row)
 *   2. Total encuestas en DW        → summary.tablas (fact_encuesta_consumo row)
 *   3. Precio promedio general      → pregunta principal AVG
 *   4. Fuentes scrapeadas           → summary.tablas (dim_fuente row)
 *   5. Categorías únicas            → summary.tablas (dim_categoria row)
 *   6. Completitud general          → allKpis.completitud[0].pct_ficha_completa
 *   7. Preferencia top              → allKpis.preferencia[0].plataforma
 *
 * The page renders a "snapshot" banner if the DW has only ONE distinct
 * date — a snapshot limitation explicitly called out in the
 * dashboard's PLAN §4.3.
 */
@Component({
  selector: 'app-resumen-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardComponent],
  template: `
    <header class="page-header">
      <h1>Resumen del DW</h1>
      <p class="page-sub">
        Visión general de los KPIs del data warehouse — 7 indicadores top.
      </p>
    </header>

    @if (store.isSnapshot()) {
      <div class="snapshot-banner" role="status">
        <span class="snapshot-banner__icon" aria-hidden="true">ℹ️</span>
        <span>
          Snapshot del <strong>{{ store.snapshotDate() }}</strong>. Los datos representan un único
          día de extracción.
        </span>
      </div>
    }

    <section class="kpi-grid" aria-label="7 KPIs principales">
      <app-kpi-card
        label="Total productos en DW"
        [value]="totalProductos()"
        icon="📦"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Total encuestas en DW"
        [value]="totalEncuestas()"
        icon="📋"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Precio promedio general"
        [value]="precioPromedio()"
        delta="USD"
        icon="💰"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Fuentes scrapeadas"
        [value]="fuentesScrapeadas()"
        icon="🌐"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Categorías únicas"
        [value]="categoriasUnicas()"
        icon="🏷️"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Completitud general"
        [value]="completitudGeneral()"
        delta="ficha completa"
        icon="✅"
        [loading]="store.loading()"
      />

      <app-kpi-card
        label="Preferencia top"
        [value]="preferenciaTop()"
        [delta]="preferenciaPct()"
        icon="🏆"
        [loading]="store.loading()"
      />
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
        background: #fffbeb;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        font-size: 0.9rem;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
        max-width: 1200px;
      }
      .error-banner {
        margin-top: 1.5rem;
        background: #fee2e2;
        border: 1px solid #ef4444;
        color: #7f1d1d;
        padding: 0.75rem 1rem;
        border-radius: 8px;
      }
    `,
  ],
})
export class ResumenPage {
  readonly store = inject(DashboardStore);

  // ─── Card derivations ─────────────────────────────────────

  /** Total productos en DW (fact_productos row count). */
  readonly totalProductos = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'fact_productos');
    return row?.registros ?? '—';
  });

  /** Total encuestas en DW (fact_encuesta_consumo row count). */
  readonly totalEncuestas = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'fact_encuesta_consumo');
    return row?.registros ?? '—';
  });

  /** Precio promedio general (AVG over pregunta principal rows). */
  readonly precioPromedio = computed<string>(() => {
    const rows = this.store.preguntaPrincipal();
    if (!rows.length) return '—';
    const total = rows.reduce((acc, r) => acc + r.precio_promedio_usd, 0);
    const avg = total / rows.length;
    return `$${avg.toFixed(2)}`;
  });

  /** Number of distinct fuentes. */
  readonly fuentesScrapeadas = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'dim_fuente');
    return row?.registros ?? '—';
  });

  /** Number of distinct categorias. */
  readonly categoriasUnicas = computed<string | number>(() => {
    const s = this.store.summary();
    if (!s) return '—';
    const row = s.tablas.find((t) => t.tabla === 'dim_categoria');
    return row?.registros ?? '—';
  });

  /** Completitud general — single-row view, take the first. */
  readonly completitudGeneral = computed<string>(() => {
    const k = this.store.kpis();
    const first = k?.completitud?.[0];
    if (!first) return '—';
    return `${first.pct_ficha_completa.toFixed(1)}%`;
  });

  /** Top-preferred plataforma (highest pct_preferencia). */
  readonly preferenciaTop = computed<string>(() => {
    const k = this.store.kpis();
    if (!k?.preferencia?.length) return '—';
    const sorted = [...k.preferencia].sort(
      (a, b) => b.pct_preferencia - a.pct_preferencia,
    );
    return sorted[0].plataforma;
  });

  /** % share of the top-preferred plataforma. */
  readonly preferenciaPct = computed<string>(() => {
    const k = this.store.kpis();
    if (!k?.preferencia?.length) return '';
    const sorted = [...k.preferencia].sort(
      (a, b) => b.pct_preferencia - a.pct_preferencia,
    );
    return `${sorted[0].pct_preferencia.toFixed(1)}% de preferencia`;
  });
}