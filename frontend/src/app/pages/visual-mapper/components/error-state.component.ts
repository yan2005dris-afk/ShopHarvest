import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vm-centered">
      <div class="vm-error-card">
        <div class="vm-error-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <h2>Something went wrong</h2>
        <p class="vm-error-msg">{{ errorMessage() }}</p>
        <button class="btn-accent" (click)="onTryAgain.emit()">Try Again</button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
      }
      .vm-centered {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .vm-error-card {
        text-align: center;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }
      .vm-error-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--color-danger-dim);
        border: 1px solid var(--color-danger-border);
        color: var(--color-danger);
      }
      .vm-error-card h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }
      .vm-error-msg {
        margin: 0;
        font-size: 0.9375rem;
        color: var(--color-on-surface-variant);
        background: var(--color-danger-dim);
        padding: 0.75rem 1rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-danger-border);
      }
      .btn-accent {
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        border: none;
        border-radius: var(--radius-md);
        background: var(--color-primary);
        color: var(--color-on-primary);
        cursor: pointer;
        transition:
          opacity 0.15s,
          transform 0.05s;
        font-family: var(--font-sans);
      }
      .btn-accent:hover {
        opacity: 0.9;
      }
      .btn-accent:active {
        transform: scale(0.98);
      }
    `,
  ],
})
export class ErrorStateComponent {
  readonly errorMessage = input.required<string>();
  readonly onTryAgain = output<void>();
}
