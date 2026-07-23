import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

/**
 * ThemeToggleComponent — small button that flips light↔dark by
 * toggling class="dark" on <html>. Self-contained: pulls
 * `themeService` from the root injector and exposes signals so the
 * template can react to state.
 *
 * Lives under the sidebar's footer (sidebar/theme-toggle/). The
 * sidebar decides layout/positioning; this component only owns the
 * click handler and the label/icon.
 *
 * Input: `collapsed` — the sidebar's collapse state. Forwarded to
 * the parent's grid layout so the icon aligns with siblings.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="nav-item nav-item--button w-full"
      [class.nav-item--collapsed]="collapsed()"
      (click)="theme.toggleTheme()"
      [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      <span class="material-symbols-outlined nav-item__icon" aria-hidden="true">{{ icon() }}</span>
      @if (!collapsed()) {
        <span class="nav-item__label">{{ label() }}</span>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  /** Sidebar collapse state — affects icon-only vs icon+label rendering. */
  readonly collapsed = input<boolean>(false);

  protected readonly icon = computed(() => (this.theme.isDark() ? 'light_mode' : 'dark_mode'));

  protected readonly label = computed(() => (this.theme.isDark() ? 'Modo claro' : 'Modo oscuro'));
}
