import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-saving-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vm-centered">
      <div class="vm-status-card">
        <div class="vm-spinner"></div>
        <p class="vm-status-title">Saving domain rule…</p>
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
      .vm-status-card {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }
      .vm-status-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .vm-spinner {
        width: 36px;
        height: 36px;
        border: 3px solid var(--color-surface-container-high);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SavingStateComponent {}
