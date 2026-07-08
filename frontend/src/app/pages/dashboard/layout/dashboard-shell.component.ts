import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DashboardService } from '../core/dashboard.service';
import type { Summary } from '../core/dashboard.types';

/**
 * Dashboard shell — sidebar nav + content outlet for the 3 dashboard
 * pages (resumen, analisis, encuesta).
 *
 * NO `authGuard` is applied at this level: per the dashboard's spec
 * the BI surface is public. The backend marks every analytics route
 * as `@Public()` and the frontend mirrors that decision by omitting
 * guard activation.
 *
 * The shell also loads the DW summary once at mount so the
 * snapshot banner can be rendered in the sidebar footer without
 * each child page having to re-fetch.
 */
@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="dashboard-shell">
      <aside class="dashboard-sidebar" aria-label="Dashboard navigation">
        <div class="dashboard-brand">
          <h2>BI Dashboard</h2>
          <p class="dashboard-brand__sub">UPSE · VI Inteligencia de Negocios</p>
        </div>

        <nav class="dashboard-nav">
          <a
            routerLink="resumen"
            routerLinkActive="active"
            class="dashboard-nav__link"
          >
            <span aria-hidden="true">📊</span>
            <span>Resumen</span>
          </a>
          <a
            routerLink="analisis"
            routerLinkActive="active"
            class="dashboard-nav__link"
          >
            <span aria-hidden="true">📈</span>
            <span>Análisis</span>
          </a>
          <a
            routerLink="encuesta"
            routerLinkActive="active"
            class="dashboard-nav__link"
          >
            <span aria-hidden="true">👥</span>
            <span>Encuesta</span>
          </a>
        </nav>

        <div class="dashboard-sidebar__footer">
          <p class="snapshot-line">
            <span class="snapshot-line__label">Snapshot</span>
            <span class="snapshot-line__value">{{ snapshot() }}</span>
          </p>
          <a class="dashboard-back" href="/" aria-label="Volver al scraper">
            ← Volver al scraper
          </a>
        </div>
      </aside>

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
        grid-template-columns: 260px 1fr;
        min-height: 100dvh;
      }
      .dashboard-sidebar {
        background: #ffffff;
        border-right: 1px solid #e5e7eb;
        padding: 1.5rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        position: sticky;
        top: 0;
        height: 100dvh;
        overflow-y: auto;
      }
      .dashboard-brand h2 {
        font-size: 1.25rem;
        margin: 0;
        color: #111827;
      }
      .dashboard-brand__sub {
        font-size: 0.75rem;
        color: #6b7280;
        margin: 0.25rem 0 0;
      }
      .dashboard-nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .dashboard-nav__link {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 0.75rem;
        border-radius: 6px;
        color: #374151;
        text-decoration: none;
        font-size: 0.9rem;
        transition: background 120ms ease;
      }
      .dashboard-nav__link:hover {
        background: #f3f4f6;
      }
      .dashboard-nav__link.active {
        background: #dbeafe;
        color: #1d4ed8;
        font-weight: 600;
      }
      .dashboard-sidebar__footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        border-top: 1px solid #e5e7eb;
        padding-top: 1rem;
      }
      .snapshot-line {
        display: flex;
        justify-content: space-between;
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
      @media (max-width: 768px) {
        .dashboard-shell {
          grid-template-columns: 1fr;
        }
        .dashboard-sidebar {
          position: static;
          height: auto;
        }
      }
    `,
  ],
})
export class DashboardShellComponent {
  private readonly dashboardService = inject(DashboardService);

  /** DW summary signal — drives the sidebar snapshot banner. */
  readonly summary = signal<Summary | null>(null);

  /**
   * Convenience signal that turns the loaded summary into a one-liner
   * suitable for the sidebar footer. Falls back to '…' while loading
   * and to '—' if the summary is unreachable so the user still sees
   * a hint that data could not be loaded.
   */
  readonly snapshot = computed<string>(() => {
    const summary = this.summary();
    if (!summary) return '…';
    const fecha = summary.snapshot?.fecha_min;
    return fecha ?? '—';
  });

  constructor() {
    this.dashboardService.getSummary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }
}