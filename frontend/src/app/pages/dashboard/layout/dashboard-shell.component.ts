import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DashboardStore } from '../core/dashboard.store';

/**
 * Dashboard shell — inline tab nav + content outlet for the 3 dashboard
 * pages (resumen, analisis, encuesta).
 *
 * Visual: glass header with accent on the active tab, full-bleed
 * content background, max-width gutter so the chart cards keep
 * a comfortable line length even on wide monitors. Adapts to the
 * global dark / light theme via CSS vars defined in `styles.css`.
 *
 * Includes a small theme toggle that flips `<html data-theme="...">`.
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
          <div class="dashboard-header__logo" aria-hidden="true">
            <span class="dashboard-header__logo-dot"></span>
          </div>
          <div class="dashboard-header__titles">
            <h2>BI Dashboard</h2>
            <p class="dashboard-header__sub">UPSE · VI Inteligencia de Negocios</p>
          </div>
        </div>

        <nav class="dashboard-tabs" aria-label="Navegación del dashboard">
          <a routerLink="resumen" routerLinkActive="active">Resumen</a>
          <a routerLink="analisis" routerLinkActive="active">Análisis</a>
          <a routerLink="encuesta" routerLinkActive="active">Encuesta</a>
        </nav>

        <div class="dashboard-header__footer">
          @if (store.isSnapshot()) {
            <p class="snapshot-line" title="Datos de un único día">
              <span class="snapshot-line__dot"></span>
              <span class="snapshot-line__label">Snapshot</span>
              <span class="snapshot-line__value">{{ snapshot() }}</span>
            </p>
          }

          <button
            type="button"
            class="theme-toggle"
            (click)="toggleTheme()"
            [attr.aria-label]="
              currentTheme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
            "
            [title]="
              currentTheme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
            "
          >
            @if (currentTheme() === 'dark') {
              <span aria-hidden="true">☀</span>
            } @else {
              <span aria-hidden="true">☾</span>
            }
          </button>

          <a class="dashboard-back" href="/" aria-label="Volver al scraper">
            ← Scraper
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
        background: var(--bg);
        background-image: var(--card-glow, none);
        background-attachment: fixed;
        font-family: var(--font);
        color: var(--text-1);
      }

      .dashboard-shell {
        display: grid;
        grid-template-columns: 1fr;
        min-height: 100dvh;
      }

      .dashboard-header {
        background: var(--header-bg);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border);
        padding: 1rem 2rem;
        display: flex;
        align-items: center;
        gap: 2rem;
        flex-wrap: wrap;
        position: sticky;
        top: 0;
        z-index: 50;
      }

      .dashboard-header__brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .dashboard-header__logo {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 16px var(--accent-dim);
      }

      .dashboard-header__logo-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ffffff;
      }

      .dashboard-header__titles h2 {
        font-size: 0.95rem;
        margin: 0;
        color: var(--text-1);
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .dashboard-header__sub {
        font-size: 0.6875rem;
        color: var(--text-3);
        margin: 0.125rem 0 0;
        letter-spacing: 0.02em;
      }

      .dashboard-tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.25rem;
        background: var(--surface);
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .dashboard-tabs a {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        color: var(--text-3);
        text-decoration: none;
        font-size: 0.8125rem;
        font-weight: 500;
        transition: color 120ms ease, background 120ms ease;
      }

      .dashboard-tabs a:hover {
        color: var(--text-1);
        background: var(--accent-dim);
      }

      .dashboard-tabs a.active {
        color: var(--text-1);
        font-weight: 600;
        background: var(--accent-dim);
        box-shadow: 0 0 0 1px var(--accent-border);
      }

      .dashboard-header__footer {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .snapshot-line {
        display: inline-flex;
        gap: 0.5rem;
        align-items: center;
        font-size: 0.75rem;
        color: var(--warning);
        margin: 0;
        padding: 0.375rem 0.625rem;
        background: var(--warning-dim);
        border-radius: 999px;
        border: 1px solid var(--warning);
        border-color: color-mix(in srgb, var(--warning) 40%, transparent);
      }

      .snapshot-line__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--warning);
        box-shadow: 0 0 6px var(--warning);
      }

      .snapshot-line__label {
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
        font-size: 0.6875rem;
      }

      .snapshot-line__value {
        font-weight: 700;
        color: var(--text-1);
        font-variant-numeric: tabular-nums;
      }

      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        font-size: 1rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        color: var(--text-2);
        transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
      }

      .theme-toggle:hover {
        color: var(--text-1);
        background: var(--accent-dim);
        border-color: var(--accent-border);
      }

      .dashboard-back {
        font-size: 0.8125rem;
        color: var(--accent);
        text-decoration: none;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        border: 1px solid var(--accent-border);
        transition: background 120ms ease;
      }

      .dashboard-back:hover {
        background: var(--accent-dim);
      }

      .dashboard-content {
        padding: 2rem;
        max-width: 1480px;
        width: 100%;
        margin: 0 auto;
      }

      @media (max-width: 720px) {
        .dashboard-header {
          padding: 0.75rem 1rem;
        }
        .dashboard-content {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class DashboardShellComponent {
  readonly store = inject(DashboardStore);

  /** DW summary signal — drives the header snapshot chip. */
  readonly snapshot = computed<string>(() => {
    const summary = this.store.summary();
    if (!summary) return '…';
    return summary.snapshot?.fecha_min ?? '—';
  });

  /** Resolved current theme (user override > system preference > dark). */
  readonly currentTheme = computed<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return (document.documentElement.getAttribute('data-theme') as
      | 'light'
      | 'dark'
      | null) ?? 'dark';
  });

  constructor() {
    this.store.initialize();
  }

  /** Flip the `data-theme` attribute on <html> and remember the choice. */
  toggleTheme(): void {
    if (typeof document === 'undefined') return;
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('dashboard-theme', next);
    } catch {
      // ignore — private mode or storage disabled
    }
  }
}
