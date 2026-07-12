import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-save-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vm-sidebar-actions">
      <button class="btn-accent btn-full"
              [disabled]="!isSaveEnabled() || domainRuleSaved()"
              (click)="onSaveRule.emit()">
        @if (domainRuleSaved()) { ✓ Saved } @else { Save Domain Rule }
      </button>

      <button class="btn-accent btn-full"
              [disabled]="extractedProductsLength() === 0 || productsIngested() || savingProducts()"
              (click)="onSaveProducts.emit()">
        @if (savingProducts()) {
          Saving…
        } @else if (productsIngested()) {
          ✓ Products ingested
        } @else {
          Save Products ({{ extractedProductsLength() }})
        }
      </button>

      @if (!isSaveEnabled()) {
        <p class="vm-save-hint">Map at least one field and a container</p>
      }
      @if (ingestError()) {
        <p class="vm-validation-error">{{ ingestError() }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 0.75rem; }
    .btn-accent { padding: 0.625rem 1rem; font-size: 0.875rem; font-weight: 600; border: none; border-radius: var(--radius); background: var(--accent); color: white; cursor: pointer; transition: opacity 0.15s, transform 0.05s; }
    .btn-accent:hover:not(:disabled) { opacity: 0.9; }
    .btn-accent:active:not(:disabled) { transform: scale(0.98); }
    .btn-accent:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-full { width: 100%; }
    .vm-save-hint { margin: 0; font-size: 0.75rem; color: var(--text-2); }
    .vm-validation-error { margin: 0; font-size: 0.8125rem; color: var(--danger); background: var(--danger-dim); padding: 0.5rem 0.75rem; border-radius: var(--radius); border: 1px solid rgba(239, 68, 68, 0.2); }
  `],
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