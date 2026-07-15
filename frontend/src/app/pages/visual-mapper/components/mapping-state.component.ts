import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MappingSessionService } from '../services/mapping-session.service';
import { SaveActionsComponent } from './save-actions.component';
import { ExtractedPreviewComponent } from './extracted-preview.component';

@Component({
  selector: 'app-mapping-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SaveActionsComponent, ExtractedPreviewComponent],
  template: `
    <div class="vm-split">
      <aside class="vm-sidebar">
        <div class="vm-sidebar-top">
          <h2 class="vm-sidebar-title">Field Mappings</h2>
          @if (pageTitle()) {
            <p class="vm-page-label">{{ pageTitle() }}</p>
          }
          <div class="vm-progress-bar-track">
            <div class="vm-progress-bar-fill" [style.width.%]="totalFieldCount() > 0 ? 100 : 0"></div>
          </div>
          <p class="vm-progress-text">{{ mappedFieldsCount() }} field(s) mapped</p>
        </div>

        <div class="vm-fields-list">
          @for (mapping of fieldMappings(); track mapping.canonicalField) {
            <div class="vm-field vm-field--ok">
              <div class="vm-field-row">
                <span class="vm-field-dot dot--ok"></span>
                <span class="vm-field-name">{{ mapping.canonicalField }}</span>
                <button class="vm-remove-btn" (click)="removeAssignment(mapping.canonicalField)" title="Remove">×</button>
              </div>
              <div class="vm-selector">
                <code class="vm-selector-text">{{ mapping.selector }}</code>
              </div>
            </div>
          }
        </div>

        <div class="vm-container-block">
          <p class="vm-section-label">Container</p>
          @if (containerSelector()) {
            <div class="vm-field vm-field--ok">
              <div class="vm-field-row">
                <span class="vm-field-dot dot--ok"></span>
                <span class="vm-field-name">Product Container</span>
              </div>
              <div class="vm-selector">
                <code class="vm-selector-text">{{ containerSelector() }}</code>
              </div>
            </div>
          } @else {
            <p class="vm-pending">No container — map it in the extension</p>
          }
        </div>

        <app-save-actions
          [domainRuleSaved]="domainRuleSaved()"
          [productsIngested]="productsIngested()"
          [savingProducts]="savingProducts()"
          [ingestError]="ingestError()"
          [extractedProductsLength]="extractedProductsLength()"
          [isSaveEnabled]="isSaveEnabled()"
          (onSaveRule)="onSaveRule.emit()"
          (onSaveProducts)="onSaveProducts.emit()"
        />
      </aside>

      <main class="vm-preview">
        <app-extracted-preview
          [session]="session()"
          [domainRuleSaved]="domainRuleSaved()"
          (onTryAgain)="onTryAgain.emit()"
        />
      </main>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; height: calc(100dvh - 0px); overflow: hidden; }
    .vm-split { display: flex; flex: 1; overflow: hidden; height: calc(100dvh - 0px); }
    .vm-sidebar { width: 280px; min-width: 280px; background: var(--color-surface-container-low); border-right: 1px solid var(--color-outline-variant); display: flex; flex-direction: column; overflow: hidden; }
    .vm-sidebar-top { padding: 1.25rem 1.25rem 0.75rem; border-bottom: 1px solid var(--color-outline-variant); }
    .vm-sidebar-title { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 700; color: var(--color-on-surface); }
    .vm-page-label { margin: 0 0 0.75rem; font-size: 0.75rem; color: var(--color-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vm-progress-bar-track { height: 3px; background: var(--color-surface-container-high); border-radius: 999px; margin-bottom: 0.375rem; }
    .vm-progress-bar-fill { height: 100%; background: var(--color-primary); border-radius: 999px; transition: width 0.3s ease; }
    .vm-progress-text { margin: 0; font-size: 0.75rem; color: var(--color-on-surface-variant); }
    .vm-fields-list { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.375rem; }
    .vm-field { padding: 0.625rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container); }
    .vm-field--ok { border-color: var(--color-success-border); background: var(--color-success-dim); }
    .vm-field-row { display: flex; align-items: center; gap: 0.5rem; }
    .vm-field-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-surface-container-high); flex-shrink: 0; }
    .dot--ok { background: var(--color-success); }
    .vm-field-name { font-size: 0.8125rem; font-weight: 600; color: var(--color-on-surface); flex: 1; }
    .vm-remove-btn { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: none; background: var(--color-danger-dim); color: var(--color-danger); border-radius: 50%; font-size: 0.875rem; cursor: pointer; padding: 0; line-height: 1; flex-shrink: 0; }
    .vm-remove-btn:hover { background: var(--color-danger); color: var(--color-on-danger); }
    .vm-selector { margin-top: 0.375rem; }
    .vm-selector-text { display: block; font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-on-surface-variant); background: var(--color-surface-container-low); padding: 0.25rem 0.5rem; border-radius: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vm-pending { margin-top: 0.25rem; font-size: 0.6875rem; color: var(--color-on-surface-variant); font-style: italic; }
    .vm-container-block { padding: 0.75rem; border-top: 1px solid var(--color-outline-variant); }
    .vm-section-label { margin: 0 0 0.5rem; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-on-surface-variant); }
    .vm-preview { flex: 1; background: var(--color-background); display: flex; overflow: hidden; }
  `],
})
export class MappingStateComponent {
  readonly session = input.required<MappingSessionService>();

  // Computed signals from session input
  readonly fieldMappings = computed(() => this.session().fieldMappings());
  readonly containerSelector = computed(() => this.session().containerSelector());
  readonly pageTitle = computed(() => this.session().pageTitle());
  readonly mappedFieldsCount = computed(() => this.session().mappedFieldsCount());
  readonly isSaveEnabled = computed(() => this.session().isSaveEnabled());
  readonly totalFieldCount = computed(() => this.session().totalFieldCount());
  readonly extractedProductsLength = computed(() => this.session().extractedProducts().length);

  readonly domainRuleSaved = input.required<boolean>();
  readonly productsIngested = input.required<boolean>();
  readonly savingProducts = input.required<boolean>();
  readonly ingestError = input.required<string>();

  readonly onSaveRule = output<void>();
  readonly onSaveProducts = output<void>();
  readonly onTryAgain = output<void>();

  removeAssignment(key: string): void {
    this.session().removeAssignment(key);
  }
}