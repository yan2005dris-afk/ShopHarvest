import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { DashboardStore } from '../core/dashboard.store';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  template: `
    <div class="dashboard-shell">
      <header class="dashboard-header">
        <div class="dashboard-header__brand">
          <div class="dashboard-header__logo" aria-hidden="true">
            <mat-icon class="text-white !size-5 !text-xl">analytics</mat-icon>
          </div>
          <div class="dashboard-header__titles">
            <h2>BI Dashboard</h2>
            <p class="dashboard-header__sub">UPSE · VI Inteligencia de Negocios</p>
          </div>
        </div>

        <nav class="dashboard-tabs" aria-label="Navegación del dashboard">
          <a routerLink="resumen" routerLinkActive="active" class="flex items-center gap-1.5">
            <mat-icon class="!size-4 !text-base">dashboard</mat-icon>
            <span>Resumen</span>
          </a>
          <a routerLink="analisis" routerLinkActive="active" class="flex items-center gap-1.5">
            <mat-icon class="!size-4 !text-base">query_stats</mat-icon>
            <span>Análisis</span>
          </a>
          <a routerLink="encuesta" routerLinkActive="active" class="flex items-center gap-1.5">
            <mat-icon class="!size-4 !text-base">poll</mat-icon>
            <span>Encuesta</span>
          </a>
        </nav>

        <div class="dashboard-header__footer">
          @if (store.isSnapshot()) {
            <mat-chip-set title="Datos de un único día">
              <mat-chip class="!min-h-7 !text-xs font-semibold">
                <span class="flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 rounded-full bg-warning"></span>
                  <span>Snapshot · {{ snapshot() }}</span>
                </span>
              </mat-chip>
            </mat-chip-set>
          }

          <button
            type="button"
            mat-icon-button
            (click)="themeService.toggleTheme()"
            [matTooltip]="themeService.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          >
            <mat-icon>
              {{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}
            </mat-icon>
          </button>

          @if (auth.isAuthenticated()) {
            <a
              mat-stroked-button
              routerLink="/mapper"
              aria-label="Volver al scraper"
            >
              <mat-icon>arrow_back</mat-icon>
              <span>Scraper</span>
            </a>
          } @else {
            <a
              mat-flat-button
              color="primary"
              routerLink="/login"
              aria-label="Iniciar sesión"
            >
              <span>Iniciar sesión</span>
            </a>
          }
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
        background: var(--color-background);
        font-family: var(--font-sans);
        color: var(--color-on-surface);
      }

      .dashboard-shell {
        display: grid;
        grid-template-columns: 1fr;
        min-height: 100dvh;
      }

      .dashboard-header {
        background: color-mix(in srgb, var(--color-surface-container-low) 85%, transparent);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--color-outline-variant);
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
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 30%, transparent);
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
        color: var(--color-on-surface);
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .dashboard-header__sub {
        font-size: 0.6875rem;
        color: var(--color-on-surface-variant);
        margin: 0.125rem 0 0;
        letter-spacing: 0.02em;
      }

      .dashboard-tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.25rem;
        background: var(--color-surface-container-low);
        border-radius: 8px;
        border: 1px solid var(--color-outline-variant);
      }

      .dashboard-tabs a {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        color: var(--color-on-surface-variant);
        text-decoration: none;
        font-size: 0.8125rem;
        font-weight: 500;
        transition:
          color 120ms ease,
          background 120ms ease;
      }

      .dashboard-tabs a:hover {
        color: var(--color-on-surface);
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      }

      .dashboard-tabs a.active {
        color: var(--color-on-surface);
        font-weight: 600;
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 40%, transparent);
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
        color: var(--color-warning);
        margin: 0;
        padding: 0.375rem 0.625rem;
        background: var(--color-warning-dim);
        border-radius: 999px;
        border: 1px solid var(--color-warning-border);
      }

      .snapshot-line__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-warning);
        box-shadow: 0 0 6px var(--color-warning);
      }

      .snapshot-line__label {
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
        font-size: 0.6875rem;
      }

      .snapshot-line__value {
        font-weight: 700;
        color: var(--color-on-surface);
        font-variant-numeric: tabular-nums;
      }

      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        font-size: 1rem;
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: 8px;
        cursor: pointer;
        color: var(--color-on-surface-variant);
        transition:
          color 120ms ease,
          background 120ms ease,
          border-color 120ms ease;
      }

      .theme-toggle:hover {
        color: var(--color-on-surface);
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
      }

      .dashboard-back {
        font-size: 0.8125rem;
        color: var(--color-primary);
        text-decoration: none;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
        transition: background 120ms ease;
      }

      .dashboard-back:hover {
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      }

      .dashboard-login {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-on-primary);
        text-decoration: none;
        padding: 0.375rem 0.875rem;
        border-radius: 6px;
        background: var(--color-primary);
        transition: filter 120ms ease;
      }

      .dashboard-login:hover {
        filter: brightness(1.08);
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
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  /** DW summary signal — drives the header snapshot chip. */
  readonly snapshot = computed<string>(() => {
    const summary = this.store.summary();
    if (!summary) return '…';
    return summary.snapshot?.fecha_min ?? '—';
  });

  constructor() {
    this.store.initialize();
  }
}
