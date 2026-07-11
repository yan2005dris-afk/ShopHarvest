import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Reusable KPI summary card.
 *
 * Three inputs cover the common dashboard cases:
 *   - `label`: short uppercase string (e.g. "Total productos").
 *   - `value`: the headline number / formatted string the card shows
 *     big. Kept as `string | number` so callers can pass either
 *     `1234` or `"$49.97"`.
 *   - `delta`: optional secondary line for trend / extra context.
 *
 * `loading` flips the card into a skeleton state so the resumen
 * page can render 7 placeholders in one shot without per-card
 * branching in the template.
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
    >
      @if (loading()) {
        <div class="kpi-label kpi-label--skeleton">&nbsp;</div>
        <div class="kpi-value kpi-value--skeleton">&nbsp;</div>
        <div class="kpi-delta kpi-delta--skeleton">&nbsp;</div>
      } @else {
        @if (icon()) {
          <span class="kpi-icon" aria-hidden="true">{{ icon() }}</span>
        }
        <div class="kpi-label">{{ label() }}</div>
        <div class="kpi-value">{{ value() }}</div>
        @if (delta()) {
          <div class="kpi-delta">{{ delta() }}</div>
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
        padding: 1.25rem;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        border: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .kpi-icon {
        position: absolute;
        top: 1rem;
        right: 1rem;
        font-size: 1.5rem;
        opacity: 0.6;
      }
      .kpi-label {
        font-size: 0.75rem;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }
      .kpi-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: #111827;
        line-height: 1.2;
        word-break: break-word;
      }
      .kpi-delta {
        font-size: 0.8rem;
        color: #10b981;
      }
      .kpi-label--skeleton,
      .kpi-value--skeleton,
      .kpi-delta--skeleton {
        background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
        background-size: 200% 100%;
        animation: shimmer 1.2s ease-in-out infinite;
        color: transparent;
        border-radius: 4px;
      }
      .kpi-label--skeleton {
        width: 60%;
        height: 0.75rem;
      }
      .kpi-value--skeleton {
        width: 80%;
        height: 1.75rem;
      }
      .kpi-delta--skeleton {
        width: 50%;
        height: 0.8rem;
      }
      @keyframes shimmer {
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
  readonly icon = input<string>('');
  readonly loading = input<boolean>(false);
}