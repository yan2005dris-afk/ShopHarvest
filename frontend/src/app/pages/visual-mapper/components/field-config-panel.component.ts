import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MappingSessionService } from '../services/mapping-session.service';
import { CANONICAL_FIELDS } from '../services/canonical-fields';

/**
 * Middle column of the mapping screen — "Extracted Fields Config".
 *
 * Container-only methodology: the extension already scraped everything
 * it could find (title-like text, prices, images, links — see
 * extractAllFromContainer). This panel is where the user picks, for
 * each PRESET canonical role, which of the auto-detected raw fields
 * feeds it — the reverse of "assign this element to a field" from the
 * old click-to-map flow. MappingSessionService seeds a sensible
 * default (exact-name match) for all four roles up front, so this
 * panel starts already configured and the user only touches what's
 * wrong.
 */
@Component({
  selector: 'app-field-config-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="fc-panel">
      <header class="fc-header">
        <h3 class="fc-title">
          <span class="fc-title__count">{{ productCount() }}</span> product(s) detected
        </h3>
      </header>

      <div class="fc-rows">
        @for (field of canonicalFields; track field.key) {
          <div class="fc-row">
            <div class="fc-row__head">
              <label class="fc-row__label">Internal: {{ field.label }}</label>
              <span class="fc-row__source"> Source: {{ effectiveSource(field.key) || '—' }} </span>
            </div>
            <select
              class="fc-select"
              [ngModel]="effectiveSource(field.key)"
              (ngModelChange)="onSourceChange(field.key, $event)"
            >
              <option value="">— Skip —</option>
              @for (opt of session().availableFields(); track opt.key) {
                <option [value]="opt.key">
                  {{ opt.label }}
                  @if (previewValue(opt); as pv) {
                    — {{ pv }}
                  }
                </option>
              }
            </select>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .fc-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-surface-container-low);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.75rem;
        overflow: hidden;
      }

      .fc-header {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container);
      }

      .fc-title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--color-on-surface);
      }

      .fc-title__count {
        color: var(--color-primary);
      }

      .fc-rows {
        flex: 1;
        overflow-y: auto;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .fc-row__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
      }

      .fc-row__label {
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }

      .fc-row__source {
        font-size: 0.75rem;
        font-style: italic;
        color: var(--color-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60%;
      }

      .fc-select {
        width: 100%;
        padding: 0.625rem 0.75rem;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: var(--color-on-surface);
        cursor: pointer;
      }

      .fc-select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
      }
    `,
  ],
})
export class FieldConfigPanelComponent {
  readonly session = input.required<MappingSessionService>();

  protected readonly canonicalFields = CANONICAL_FIELDS;

  protected readonly productCount = computed(() => this.session().extractedProducts().length);

  /** The raw key currently feeding `canonicalKey`, or '' if none. */
  effectiveSource(canonicalKey: string): string {
    return this.session().getFieldMapping(canonicalKey)?.extractedKey ?? '';
  }

  onSourceChange(canonicalKey: string, rawKey: string): void {
    if (rawKey) {
      this.session().selectFieldForMapping(rawKey, canonicalKey);
    } else {
      this.session().removeAssignment(canonicalKey);
    }
  }

  /** Short sample value shown next to each dropdown option. */
  previewValue(opt: { selectedValue: string | number | null }): string {
    const v = opt.selectedValue;
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.length > 30 ? s.slice(0, 30) + '…' : s;
  }
}
