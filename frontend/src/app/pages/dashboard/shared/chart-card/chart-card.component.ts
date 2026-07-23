import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Reusable chart container card.
 *
 * Provides consistent header treatment across the dashboard: title,
 * optional caption/period subtitle, and a body slot via content
 * projection. Card visual matches the KPI cards via the global CSS
 * theme variables — light / dark switch transparently.
 *
 * Usage:
 *   <app-chart-card title="Ventas por período" caption="2009–2012">
 *     <apx-chart ... />
 *   </app-chart-card>
 *
 * Inputs:
 *   - `title`:    card heading (required).
 *   - `caption`:  optional secondary line under the title.
 *   - `accent`:   optional CSS color override for the top stripe.
 *   - `padding`:  inner padding mode ('normal' | 'tight'). Default normal.
 */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="chart-card"
      [class.chart-card--tight]="padding() === 'tight'"
      [style.--accent]="accent() || 'var(--color-primary)'"
    >
      <span class="chart-card__accent" aria-hidden="true"></span>

      <header class="chart-card__header">
        <div class="chart-card__titles">
          <h3 class="chart-card__title">{{ title() }}</h3>
          @if (caption()) {
            <p class="chart-card__caption">{{ caption() }}</p>
          }
        </div>
        <ng-content select="[card-actions]" />
      </header>

      <div class="chart-card__body">
        <ng-content />
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .chart-card {
        position: relative;
        padding: 1.25rem 1.25rem 1.25rem;
        border-radius: 14px;
        background: var(--color-surface-container-low);
        backdrop-filter: blur(8px);
        border: 1px solid var(--color-outline-variant);
        font-family: var(--font-sans);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease;
      }

      .chart-card:hover {
        border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
      }

      .chart-card__accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--accent);
        opacity: 0.7;
      }

      .chart-card__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .chart-card__titles {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }

      .chart-card__title {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--color-on-surface);
        letter-spacing: 0.01em;
        line-height: 1.3;
      }

      .chart-card__caption {
        margin: 0;
        font-size: 0.6875rem;
        color: var(--color-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 500;
      }

      .chart-card__body {
        flex: 1 1 auto;
        min-height: 220px;
        position: relative;
      }

      .chart-card--tight .chart-card__body {
        min-height: 0;
      }

      .chart-card--tight {
        padding: 1rem 1rem 1rem;
        gap: 0.75rem;
      }
    `,
  ],
})
export class ChartCardComponent {
  readonly title = input.required<string>();
  readonly caption = input<string>('');
  readonly accent = input<string>('');
  readonly padding = input<'normal' | 'tight'>('normal');
}
