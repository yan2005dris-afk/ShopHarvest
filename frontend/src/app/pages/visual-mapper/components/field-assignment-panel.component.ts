import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { MappingSessionService } from '../services/mapping-session.service';

@Component({
  selector: 'app-field-assignment-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
            <button
              class="vm-remove-btn"
              (click)="removeAssignment(mapping.canonicalField)"
              title="Remove"
            >
              ×
            </button>
          </div>
          <div class="vm-selector">
            <code class="vm-selector-text">{{ mapping.selector }}</code>
          </div>
        </div>
      } @empty {
        <p class="vm-pending">No fields mapped yet</p>
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
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .vm-sidebar-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }
      .vm-page-label {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
      .vm-progress-bar-track {
        height: 4px;
        background: var(--color-outline-variant);
        border-radius: 2px;
        margin: 0.5rem 0;
        overflow: hidden;
      }
      .vm-progress-bar-fill {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.2s ease;
      }
      .vm-progress-text {
        margin: 0;
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
      }
      .vm-fields-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .vm-field {
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-md);
        padding: 0.75rem;
      }
      .vm-field--ok {
        border-color: var(--color-success-border);
      }
      .vm-field-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .vm-field-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-on-surface-variant);
      }
      .vm-field-dot.dot--ok {
        background: var(--color-success);
      }
      .vm-field-name {
        flex: 1;
        font-size: 0.875rem;
        color: var(--color-on-surface);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .vm-remove-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: var(--color-on-surface-variant);
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        border-radius: var(--radius-md);
      }
      .vm-remove-btn:hover {
        background: var(--color-danger-dim);
        color: var(--color-danger);
      }
      .vm-selector {
        margin-top: 0.5rem;
        padding: 0.375rem 0.5rem;
        background: var(--color-surface-container);
        border-radius: var(--radius-md);
      }
      .vm-selector-text {
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
        word-break: break-all;
        font-family: var(--font-mono);
      }
      .vm-container-block {
        margin-top: 0.5rem;
      }
      .vm-section-label {
        margin: 0 0 0.375rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-on-surface-variant);
      }
      .vm-pending {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
export class FieldAssignmentPanelComponent {
  readonly session = input.required<MappingSessionService>();

  // Derived signals from session input
  readonly fieldMappings = computed(() => this.session().fieldMappings());
  readonly containerSelector = computed(() => this.session().containerSelector());
  readonly pageTitle = computed(() => this.session().pageTitle());
  readonly mappedFieldsCount = computed(() => this.session().mappedFieldsCount());
  readonly isSaveEnabled = computed(() => this.session().isSaveEnabled());
  readonly totalFieldCount = computed(() => this.session().totalFieldCount());

  removeAssignment(key: string): void {
    this.session().removeAssignment(key);
  }
}
