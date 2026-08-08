import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

type AccentToken = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

const ACCENT_VAR: Record<AccentToken, string> = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatCardModule],
  template: `
    <mat-card
      appearance="outlined"
      class="kpi-card !relative !flex !flex-col !gap-2 !overflow-hidden !rounded-xl !border-outline-variant !bg-surface-container-low !p-6 font-sans transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary"
      [class.kpi-card--loading]="loading()"
      [attr.aria-busy]="loading()"
      [style.--accent]="accentVar()"
    >
      <!-- 2px top accent bar -->
      <span
        class="absolute inset-x-0 top-0 h-0.5"
        [style.background-color]="'var(--accent)'"
        aria-hidden="true"
      ></span>

      @if (loading()) {
        <div class="kpi-card__skeleton kpi-card__skeleton--label"></div>
        <div class="kpi-card__skeleton kpi-card__skeleton--value"></div>
        <div class="kpi-card__skeleton kpi-card__skeleton--delta"></div>
      } @else {
        <header class="flex items-center gap-2">
          @if (icon()) {
            <mat-icon
              class="material-symbols-outlined text-on-surface-variant !size-4.5 !text-lg"
              aria-hidden="true"
              >{{ icon() }}</mat-icon
            >
          }
          <span class="text-label-caps text-on-surface-variant" data-testid="kpi-label">
            {{ label() }}
          </span>
        </header>

        <div class="text-metric-value text-on-surface" data-testid="kpi-value">
          {{ value() }}
        </div>

        @if (delta()) {
          <div
            class="inline-flex items-center gap-1 text-body-md"
            [class.text-success]="trend() === 'up'"
            [class.text-danger]="trend() === 'down'"
            [class.text-on-surface-variant]="!trend()"
            data-testid="kpi-delta"
          >
            @if (trend() === 'up') {
              <mat-icon class="!size-3.5 !text-sm">trending_up</mat-icon>
            }
            @if (trend() === 'down') {
              <mat-icon class="!size-3.5 !text-sm">trending_down</mat-icon>
            }
            <span>{{ delta() }}</span>
          </div>
        }
      }
    </mat-card>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Skeleton shimmer — uses M3 surface tokens instead of the
         removed --surface-2/3 pair. The animation is the same
         (left-to-right gradient sweep) but the source tones are
         container-low → container → container-low. */
      .kpi-card__skeleton {
        background: linear-gradient(
          90deg,
          var(--color-surface-container-low) 0%,
          var(--color-surface-container-high) 50%,
          var(--color-surface-container-low) 100%
        );
        background-size: 200% 100%;
        animation: kpi-shimmer 1.4s ease-in-out infinite;
        border-radius: var(--radius-xs);
      }

      .kpi-card__skeleton--label {
        width: 55%;
        height: 0.6875rem;
      }

      .kpi-card__skeleton--value {
        width: 75%;
        height: 2.5rem;
      }

      .kpi-card__skeleton--delta {
        width: 45%;
        height: 0.75rem;
      }

      .kpi-card--loading {
        gap: 0.6rem;
      }

      @keyframes kpi-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `,
  ],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly delta = input<string>('');
  readonly trend = input<'up' | 'down' | undefined>(undefined);
  readonly icon = input<string>('');
  /** Token key — see AccentToken. Default: 'primary'. */
  readonly accent = input<AccentToken>('primary');
  readonly loading = input<boolean>(false);

  /**
   * Resolved CSS var for the top accent bar. Computed from the
   * `accent` input so the template can stay declarative.
   */
  protected readonly accentVar = computed(() => ACCENT_VAR[this.accent()]);
}
