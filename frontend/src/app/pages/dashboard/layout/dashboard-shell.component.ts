import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DashboardStore } from '../core/dashboard.store';

/**
 * Dashboard shell — inline tab nav + content outlet for the 3 dashboard
 * pages (resumen, analisis, encuesta).
 *
 * NO `authGuard` is applied at this level: per the dashboard's spec
 * the BI surface is public. The backend marks every analytics route
 * as `@Public()` and the frontend mirrors that decision by omitting
 * guard activation.
 *
 * The shell also loads the DW summary once at mount so the
 * snapshot line can be rendered in the header without
 * each child page having to re-fetch.
 */
@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="dashboard-shell">
      <header class="dashboard-header">
        <div class="dashboard-header__brand">
          <h2>BI Dashboard</h2>
          <p class="dashboard-header__sub">UPSE · VI Inteligencia de Negocios</p>
        </div>
        <nav class="dashboard-tabs">
          <a routerLink="resumen" routerLinkActive="active">Resumen</a>
          <a routerLink="analisis" routerLinkActive="active">Análisis</a>
          <a routerLink="encuesta" routerLinkActive="active">Encuesta</a>
        </nav>
        <div class="dashboard-header__footer">
          <p class="snapshot-line">
            <span class="snapshot-line__label">Snapshot</span>
            <span class="snapshot-line__value">{{ snapshot() }}</span>
          </p>
          <a class="dashboard-back" href="/" aria-label="Volver al scraper">
            ← Volver al scraper
          </a>
        </div>
      </header>

      <main class="dashboard-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-height: 100dvh;
        background: #f3f4f6;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .dashboard-shell {
        display: grid;
        grid-template-columns: 1fr;
        min-height: 100dvh;
      }
      .dashboard-header {
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        padding: 1rem 2rem;
        display: flex;
        align-items: center;
        gap: 2rem;
        flex-wrap: wrap;
      }
      .dashboard-header__brand h2 {
        font-size: 1.25rem;
        margin: 0;
        color: #111827;
      }
      .dashboard-header__sub {
        font-size: 0.75rem;
        color: #6b7280;
        margin: 0.25rem 0 0;
      }
      .dashboard-tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem 1rem;
      }
      .dashboard-tabs a {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        color: #6b7280;
        text-decoration: none;
        font-size: 0.9rem;
        transition: color 120ms ease, background 120ms ease;
        border-bottom: 3px solid transparent;
      }
      .dashboard-tabs a:hover {
        color: #374151;
        background: #f3f4f6;
      }
      .dashboard-tabs a.active {
        color: #1d4ed8;
        font-weight: 600;
        border-bottom: 3px solid #1d4ed8;
      }
      .dashboard-header__footer {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }
      .snapshot-line {
        display: flex;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #6b7280;
        margin: 0;
      }
      .snapshot-line__value {
        font-weight: 600;
        color: #111827;
      }
      .dashboard-back {
        font-size: 0.8rem;
        color: #3b82f6;
        text-decoration: none;
      }
      .dashboard-back:hover {
        text-decoration: underline;
      }
      .dashboard-content {
        padding: 2rem;
        max-width: 1400px;
        width: 100%;
        margin: 0 auto;
      }
    `,
  ],
})
export class DashboardShellComponent {
  private readonly store = inject(DashboardStore);

  /** DW summary signal — drives the sidebar snapshot banner. */
  readonly snapshot = computed<string>(() => {
    const summary = this.store.summary();
    if (!summary) return '…';
    const fecha = summary.snapshot?.fecha_min;
    return fecha ?? '—';
  });

  constructor() {
    // Initialize the dashboard store on first mount of the shell
    this.store.initialize();
  }
}