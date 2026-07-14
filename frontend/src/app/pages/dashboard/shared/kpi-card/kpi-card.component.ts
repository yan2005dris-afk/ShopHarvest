import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Reusable KPI summary card.
 *
 * Adapts to the global dark / light theme via CSS custom properties
 * (defined in `styles.css`). Three inputs cover the common cases:
 *   - `label`: short uppercase string (e.g. "Total productos").
 *   - `value`: the headline number / formatted string the card shows
 *     big. Kept as `string | number` so callers can pass either
 *     `1234` or `"$49.97"`.
 *   - `delta`: optional secondary line for trend / extra context.
 *   - `trend`: 'up' | 'down' | undefined — color of the delta line.
 *   - `accent`: optional CSS color override for the top accent bar.
 *
 * `loading` flips the card into a skeleton state.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="kpi-card"
      [class.kpi-card--loading]="loading()"
      [attr.aria-busy]="loading()"
      [style.--accent]="accent() || 'var(--accent)'"
    >
      <span class="kpi-card__accent" aria-hidden="true"></span>

      @if (loading()) {
        <div class="kpi-card__skeleton kpi-card__skeleton--label"></div>
        <div class="kpi-card__skeleton kpi-card__skeleton--value"></div>
        <div class="kpi-card__skeleton kpi-card__skeleton--delta"></div>
      } @else {
        <header class="kpi-card__header">
          @if (icon()) {
            <span class="kpi-card__icon" aria-hidden="true">{{ icon() }}</span>
          }
          <span class="kpi-card__label">{{ label() }}</span>
        </header>

        <div class="kpi-card__value">{{ value() }}</div>

        @if (delta()) {
          <div
            class="kpi-card__delta"
            [class.kpi-card__delta--up]="trend() === 'up'"
            [class.kpi-card__delta--down]="trend() === 'down'"
          >
            @if (trend() === 'up') {
              <span class="kpi-card__trend-glyph" aria-hidden="true">▲</span>
            }
            @if (trend() === 'down') {
              <span class="kpi-card__trend-glyph" aria-hidden="true">▼</span>
            }
            <span>{{ delta() }}</span>
          </div>
        }
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .kpi-card {
        position: relative;
        padding: 1.5rem 1.25rem 1.25rem;
        border-radius: 12px;
        background: var(--surface);
        background-image: var(--card-glass, none);
        backdrop-filter: blur(8px);
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-family: var(--font);
        overflow: hidden;
        transition: border-color 0.18s ease, transform 0.18s ease,
          box-shadow 0.18s ease;
        box-shadow: var(--shadow-card, none);
      }

      .kpi-card:hover {
        border-color: var(--accent-border);
        transform: translateY(-2px);
        box-shadow: var(--shadow-card-hover, none);
      }

      .kpi-card__accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--accent, var(--accent));
        opacity: 0.85;
      }

      .kpi-card__header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .kpi-card__icon {
        font-size: 0.95rem;
        opacity: 0.7;
        line-height: 1;
      }

      .kpi-card__label {
        font-size: 0.6875rem;
        color: var(--text-3);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }

      .kpi-card__value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-1);
        line-height: 1.1;
        letter-spacing: -0.025em;
        word-break: break-word;
        margin-top: 0.25rem;
      }

      .kpi-card__delta {
        font-size: 0.75rem;
        color: var(--text-3);
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.25rem;
      }

      .kpi-card__delta--up {
        color: var(--success);
      }

      .kpi-card__delta--down {
        color: var(--danger);
      }

      .kpi-card__trend-glyph {
        font-size: 0.65rem;
      }

      .kpi-card--loading {
        gap: 0.6rem;
      }

      .kpi-card__skeleton {
        background: linear-gradient(
          90deg,
          var(--surface-2) 0%,
          var(--surface-3) 50%,
          var(--surface-2) 100%
        );
        background-size: 200% 100%;
        animation: kpi-shimmer 1.4s ease-in-out infinite;
        border-radius: 4px;
      }

      .kpi-card__skeleton--label {
        width: 55%;
        height: 0.6875rem;
      }

      .kpi-card__skeleton--value {
        width: 75%;
        height: 2rem;
      }

      .kpi-card__skeleton--delta {
        width: 45%;
        height: 0.75rem;
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
  readonly accent = input<string>('');
  readonly loading = input<boolean>(false);
}
