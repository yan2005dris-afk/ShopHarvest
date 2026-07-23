import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-save-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sa-bar">
      @if (!isSaveEnabled()) {
        <p class="sa-hint">Map at least one field and a container</p>
      }
      @if (ingestError()) {
        <p class="sa-error">{{ ingestError() }}</p>
      }

      <div class="sa-buttons">
        <button
          class="sa-btn sa-btn--outline"
          [disabled]="!isSaveEnabled() || domainRuleSaved()"
          (click)="onSaveRule.emit()"
        >
          @if (domainRuleSaved()) {
            ✓ Saved
          } @else {
            Save Domain Rule
          }
        </button>

        <button
          class="sa-btn sa-btn--filled"
          [disabled]="extractedProductsLength() === 0 || productsIngested() || savingProducts()"
          (click)="onSaveProducts.emit()"
        >
          @if (savingProducts()) {
            Saving…
          } @else if (productsIngested()) {
            ✓ Products ingested
          } @else {
            Save Products ({{ extractedProductsLength() }})
          }
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sa-bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .sa-buttons {
        display: flex;
        gap: 0.75rem;
        margin-left: auto;
      }
      .sa-btn {
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 700;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition:
          opacity 0.15s,
          background 0.15s,
          transform 0.05s;
        white-space: nowrap;
      }
      .sa-btn:active:not(:disabled) {
        transform: scale(0.98);
      }
      .sa-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .sa-btn--outline {
        background: transparent;
        border: 1px solid var(--color-primary);
        color: var(--color-primary);
      }
      .sa-btn--outline:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      }
      .sa-btn--filled {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border: none;
      }
      .sa-btn--filled:hover:not(:disabled) {
        background: var(--color-primary-container);
      }
      .sa-hint {
        margin: 0;
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
      }
      .sa-error {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--color-danger);
        background: var(--color-danger-dim);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-danger-border);
      }
    `,
  ],
})
export class SaveActionsComponent {
  readonly domainRuleSaved = input.required<boolean>();
  readonly productsIngested = input.required<boolean>();
  readonly savingProducts = input.required<boolean>();
  readonly ingestError = input.required<string>();
  readonly extractedProductsLength = input.required<number>();
  readonly isSaveEnabled = input.required<boolean>();
  readonly onSaveRule = output<void>();
  readonly onSaveProducts = output<void>();
}
