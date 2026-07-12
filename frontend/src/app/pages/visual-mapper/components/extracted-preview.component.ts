import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MappingSessionService } from '../services/mapping-session.service';

@Component({
  selector: 'app-extracted-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session().extractedProducts().length > 0) {
      <div class="vm-products-panel">
        <div class="vm-panel-header">
          <h3>{{ session().extractedProducts().length }} product(s) extracted</h3>
        </div>
        <div class="vm-product-cards">
          @for (prod of session().extractedProducts(); track $index) {
            <div class="vm-product-card">
              @for (field of session().fieldMappings(); track field.canonicalField) {
                <div class="vm-prod-field">
                  <span class="vm-prod-label">{{ field.canonicalField }}</span>
                  <span class="vm-prod-value">
                    @if (field.type === 'attribute' && field.attribute === 'src') {
                      <img [src]="prod[field.canonicalField]" alt="" class="vm-prod-img" />
                    } @else if (isUrlValue(prod[field.canonicalField])) {
                      <span [title]="prod[field.canonicalField]">{{ prod[field.canonicalField] }}</span>
                    } @else {
                      {{ prod[field.canonicalField] }}
                    }
                  </span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="vm-preview-msg">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <p>Mapping received from extension</p>

        <div class="vm-summary-box">
          <p><strong>{{ session().mappedFieldsCount() }}</strong> field(s) mapped</p>
          @if (session().containerSelector()) {
            <p>Container: <code>{{ session().containerSelector() }}</code></p>
          }
          <p class="vm-preview-sub">
            These fields will be applied to each product on the page.
          </p>
          <p class="vm-preview-sub">
            💡 Scroll down in the extension tab to load more items before clicking Finish Mapping,
            or close this and <a class="vm-hint-link vm-retry-link" (click)="onTryAgain.emit()">try again</a>.
          </p>
        </div>

        @if (domainRuleSaved()) {
          <p class="vm-preview-saved-badge">✅ Domain rule saved</p>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .vm-products-panel { flex: 1; overflow-y: auto; }
    .vm-panel-header { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 600; color: var(--text-2); }
    .vm-product-cards { display: flex; flex-direction: column; gap: 0.75rem; }
    .vm-product-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .vm-prod-field { display: flex; flex-direction: column; gap: 0.125rem; }
    .vm-prod-label { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); }
    .vm-prod-value { font-size: 0.8125rem; color: var(--text-1); word-break: break-all; }
    .vm-prod-img { max-width: 100%; max-height: 120px; object-fit: contain; border-radius: var(--radius); background: var(--surface-2); }
    .vm-preview-msg { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; gap: 1rem; color: var(--text-3); }
    .vm-preview-msg svg { color: var(--success); }
    .vm-preview-msg p { margin: 0; font-size: 0.9375rem; color: var(--text-2); }
    .vm-summary-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1rem 1.25rem; text-align: left; max-width: 400px; font-size: 0.875rem; color: var(--text-2); line-height: 1.6; }
    .vm-summary-box code { font-family: var(--font-mono); font-size: 0.75rem; background: var(--surface-2); padding: 0.125rem 0.375rem; border-radius: 0.25rem; color: var(--text-1); }
    .vm-preview-sub { font-size: 0.8125rem; color: var(--text-3) !important; }
    .vm-retry-link { cursor: pointer; text-decoration: underline; color: var(--accent); }
    .vm-preview-saved-badge { font-size: 0.875rem; font-weight: 600; color: var(--success); margin-top: 0.5rem; }
  `],
})
export class ExtractedPreviewComponent {
  readonly session = input.required<MappingSessionService>();
  readonly domainRuleSaved = input.required<boolean>();
  readonly onTryAgain = output<void>();

  isUrlValue(value: unknown): boolean {
    return String(value ?? '').startsWith('http');
  }
}