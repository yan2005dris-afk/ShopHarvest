import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MappingSessionService } from '../services/mapping-session.service';
import type { Category, DomainRule } from '../../../services/api.service';

@Component({
  selector: 'app-mapper-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="vm-hero">
      <div class="vm-hero-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>
      <h1 class="vm-hero-title">Map a new store</h1>
      <p class="vm-hero-sub">Enter a URL, then click elements in the extension to assign fields</p>

      <div class="vm-input-card">
        <label class="vm-label" for="url-input">Store URL</label>
        <div class="vm-url-row">
          <input
            id="url-input"
            type="url"
            class="vm-input"
            [(ngModel)]="url"
            placeholder="https://store.example.com/products"
            autofocus
          />
          <button
            class="btn-accent"
            (click)="onOpenMapper.emit()"
            [disabled]="!extensionAvailable()">
            @if (extensionAvailable()) { Open Mapper } @else { Not detected }
          </button>
        </div>
        @if (urlValidationError()) {
          <p class="vm-validation-error">{{ urlValidationError() }}</p>
        }
        @if (!extensionAvailable()) {
          <p class="vm-hint">
            <a routerLink="/setup" class="vm-hint-link">Install the extension</a> to map fields visually.
          </p>
        }
      </div>

      <div class="vm-input-card vm-category-card">
        <label class="vm-label" for="category-select">Category</label>
        <div class="vm-category-row">
          <select
            id="category-select"
            class="vm-select"
            [ngModel]="categoryId()"
            (ngModelChange)="categoryId.set($event)">
            <option value="">— No category —</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">
                {{ cat.name }}@if (cat.description) { — {{ cat.description }} }
              </option>
            }
          </select>
          @if (selectedCat) {
            <span class="vm-category-badge">{{ selectedCat.name }}</span>
          }
        </div>
        <p class="vm-hint">Groups this domain under a category. <a routerLink="/categories" class="vm-hint-link">Manage categories</a></p>
      </div>

      @if (domains().length > 0) {
        <div class="vm-saved">
          <p class="vm-saved-label">Saved domains</p>
          <div class="vm-chips">
            @for (d of domains(); track d.id) {
              <span class="vm-chip">
                {{ d.domain }}
                @if (d.categoryName) {
                  <span class="vm-chip-cat">{{ d.categoryName }}</span>
                }
              </span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 3rem 2rem; text-align: center; gap: 1rem; }
    .vm-hero-icon { display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: var(--radius-xl); background: color-mix(in srgb, var(--color-primary) 15%, transparent); border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent); color: var(--color-primary); margin-bottom: 0.25rem; }
    .vm-hero-title { margin: 0; font-size: 1.875rem; font-weight: 700; letter-spacing: -0.02em; color: var(--color-on-surface); }
    .vm-hero-sub { margin: 0; font-size: 1rem; color: var(--color-on-surface-variant); max-width: 440px; }
    .vm-input-card { width: 100%; max-width: 580px; background: var(--color-surface-container-low); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); padding: 1.5rem; margin-top: 0.5rem; }
    .vm-label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 600; color: var(--color-on-surface); }
    .vm-url-row { display: flex; gap: 0.625rem; }
    .vm-input { flex: 1; padding: 0.6875rem 0.875rem; background: var(--color-surface-container); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-md); font-size: 0.9375rem; color: var(--color-on-surface); font-family: var(--font-sans); transition: border-color 0.15s, box-shadow 0.15s; min-width: 0; }
    .vm-input::placeholder { color: var(--color-on-surface-variant); }
    .vm-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent); }
    .vm-validation-error { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--color-danger); background: var(--color-danger-dim); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--color-danger-border); }
    .vm-hint { margin: 0.625rem 0 0; font-size: 0.8125rem; color: var(--color-on-surface-variant); }
    .vm-hint-link { color: var(--color-primary); cursor: pointer; }
    .vm-saved { margin-top: 2rem; }
    .vm-saved-label { margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-on-surface-variant); }
    .vm-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center; }
    .vm-chip { background: var(--color-surface-container); border: 1px solid var(--color-outline-variant); border-radius: 999px; padding: 0.25rem 0.75rem; font-size: 0.8125rem; color: var(--color-on-surface); display: inline-flex; align-items: center; gap: 0.375rem; }
    .vm-chip-cat { font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); padding: 0.0625rem 0.375rem; border-radius: 0.25rem; }
    .vm-category-card { margin-top: 0.75rem; }
    .vm-category-row { display: flex; gap: 0.625rem; align-items: center; }
    .vm-select {
      flex: 1; padding: 0.6875rem 0.875rem; background: var(--color-surface-container); border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-md); font-size: 0.9375rem; color: var(--color-on-surface); font-family: var(--font-sans);
      cursor: pointer; min-width: 0;
    }
    .vm-select:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent); }
    .vm-category-badge {
      font-size: 0.75rem; font-weight: 600; background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary);
      padding: 0.25rem 0.625rem; border-radius: var(--radius-md); white-space: nowrap;
    }
    .vm-category-card .vm-hint { margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-on-surface-variant); }
  `],
})
export class MapperHeroComponent {
  readonly session = input.required<MappingSessionService>();
  readonly domains = input.required<DomainRule[]>();
  readonly categories = input.required<Category[]>();
  readonly extensionAvailable = input.required<boolean>();
  readonly url = model.required<string>();
  readonly urlValidationError = input.required<string>();
  readonly categoryId = model.required<string>();
  readonly onOpenMapper = output<void>();

  /** Computed: the currently selected Category object. */
  get selectedCat(): Category | undefined {
    const id = this.categoryId();
    if (!id) return undefined;
    return this.categories().find((c) => c.id === id);
  }
}
