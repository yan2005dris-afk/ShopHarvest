import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <button
      type="button"
      class="nav-item nav-item--button w-full"
      [class.nav-item--collapsed]="collapsed()"
      (click)="theme.toggleTheme()"
      [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      [matTooltip]="collapsed() ? label() : ''"
      matTooltipPosition="right"
    >
      <mat-icon class="nav-item__icon" aria-hidden="true">{{ icon() }}</mat-icon>
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
