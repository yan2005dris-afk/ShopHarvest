import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-done-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="vm-centered">
      <div class="vm-done-card">
        <div class="vm-done-icon">
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2>Done</h2>

        @if (domainRuleSaved()) {
          <p class="vm-done-desc">
            ✅ Domain rule for <strong>{{ url() }}</strong> saved.
          </p>
        }

        @if (productsIngested()) {
          <p class="vm-done-desc">✅ {{ extractedProductsCount() }} product(s) ingested.</p>
        } @else if (extractedProductsCount() > 0 && !domainRuleSaved()) {
          <p class="vm-done-desc">{{ extractedProductsCount() }} product(s) ready to save.</p>
        }

        @if (domainRuleSaved() && savedDomain() && extensionAvailable()) {
          <div class="vm-schedule">
            <h3 class="vm-schedule-title">Auto-scrape</h3>
            <p class="vm-schedule-hint">
              Re-run this rule automatically while a tab on
              <strong>{{ savedDomain() }}</strong> is open.
            </p>
            <div class="vm-schedule-row">
              <label>
                Every
                <input
                  type="number"
                  min="1"
                  step="1"
                  class="vm-schedule-input"
                  [(ngModel)]="scheduleIntervalHours"
                />
                hour(s)
              </label>
              <label class="vm-schedule-toggle">
                <input type="checkbox" [(ngModel)]="scheduleEnabled" />
                Enabled
              </label>
            </div>
            <button
              class="btn-accent"
              [disabled]="savingSchedule()"
              (click)="onSaveSchedule.emit()"
            >
              @if (savingSchedule()) {
                Saving…
              } @else if (scheduleSaved()) {
                ✓ Schedule saved
              } @else {
                Save schedule
              }
            </button>
            @if (scheduleError()) {
              <p class="vm-error-msg">{{ scheduleError() }}</p>
            }
          </div>
        } @else if (domainRuleSaved() && savedDomain() && !extensionAvailable()) {
          <div class="vm-schedule">
            <h3 class="vm-schedule-title">Auto-scrape</h3>
            <p class="vm-schedule-hint">Install the extension to enable automatic re-scraping.</p>
          </div>
        }

        @if (ingestError()) {
          <p class="vm-error-msg">{{ ingestError() }}</p>
        }
        @if (errorMessage()) {
          <p class="vm-error-msg">{{ errorMessage() }}</p>
        }

        <div class="vm-done-actions">
          <button class="btn-accent" (click)="onTryAgain.emit()">Map another page</button>
          <a routerLink="/products" class="btn-ghost">View Products</a>
        </div>
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
      .vm-done-card {
        text-align: center;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }
      .vm-done-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--color-success-dim);
        border: 1px solid var(--color-success-border);
        color: var(--color-success);
      }
      .vm-done-card h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }
      .vm-done-desc {
        margin: 0;
        font-size: 0.9375rem;
        color: var(--color-on-surface-variant);
      }
      .vm-schedule {
        margin: 1rem 0;
        padding: 1rem;
        text-align: left;
        background: var(--color-surface-container);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-lg);
      }
      .vm-schedule-title {
        margin: 0 0 0.5rem;
        font-size: 0.95rem;
        color: var(--color-on-surface);
      }
      .vm-schedule-hint {
        margin: 0 0 0.75rem;
        font-size: 0.85rem;
        color: var(--color-on-surface-variant);
      }
      .vm-schedule-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
        font-size: 0.85rem;
        color: var(--color-on-surface);
      }
      .vm-schedule-input {
        width: 64px;
        margin: 0 0.375rem;
        padding: 0.375rem 0.5rem;
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-md);
        color: var(--color-on-surface);
        font-family: var(--font-sans);
      }
      .vm-schedule-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
      }
      .vm-schedule-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }
      .vm-error-msg {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: var(--color-danger);
        background: var(--color-danger-dim);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-danger-border);
      }
      .vm-done-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 0.5rem;
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
      .btn-ghost {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.625rem 1.25rem;
        background: transparent;
        color: var(--color-on-surface-variant);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition:
          color 0.15s,
          border-color 0.15s,
          background 0.15s;
        font-family: var(--font-sans);
      }
      .btn-ghost:hover {
        color: var(--color-on-surface);
        border-color: var(--color-outline);
        background: var(--color-surface-container);
      }
    `,
  ],
})
export class DoneStateComponent {
  readonly domainRuleSaved = input.required<boolean>();
  readonly productsIngested = input.required<boolean>();
  readonly extractedProductsCount = input.required<number>();
  readonly url = input.required<string>();
  readonly savedDomain = input.required<string | null>();
  readonly extensionAvailable = input.required<boolean>();
  readonly scheduleIntervalHours = model.required<number>();
  readonly scheduleEnabled = model.required<boolean>();
  readonly scheduleSaved = input.required<boolean>();
  readonly scheduleError = input.required<string>();
  readonly savingSchedule = input.required<boolean>();
  readonly ingestError = input.required<string>();
  readonly errorMessage = input.required<string>();
  readonly onTryAgain = output<void>();
  readonly onSaveSchedule = output<void>();
}
