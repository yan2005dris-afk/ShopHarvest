import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * ExtensionStatusComponent — sidebar footer entry that links to
 * `/setup` (the Chrome-extension installer page) and shows an
 * ON/OFF badge next to the label, or a tiny dot when collapsed.
 *
 * Inputs:
 *   - collapsed — true when the sidebar is collapsed (icons-only).
 *     When true, the label hides and the badge collapses to a
 *     8px status dot.
 */
@Component({
  selector: 'app-extension-status',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/setup"
      routerLinkActive="active"
      class="nav-item"
      [class.nav-item--collapsed]="collapsed()"
    >
      <span class="material-symbols-outlined nav-item__icon" aria-hidden="true"
        >extension</span
      >
      @if (!collapsed()) {
        <span class="nav-item__label">Extensión</span>
        <span
          class="ml-auto rounded-xs px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
          [class.bg-success-dim]="available()"
          [class.text-success]="available()"
          [class.bg-danger-dim]="!available()"
          [class.text-danger]="!available()"
        >
          {{ available() ? 'ON' : 'OFF' }}
        </span>
      } @else {
        <span
          class="absolute right-1 top-1 h-2 w-2 rounded-full"
          [class.bg-success]="available()"
          [class.bg-danger]="!available()"
          [attr.aria-label]="available() ? 'Extension active' : 'Extension off'"
        ></span>
      }
    </a>
  `,
})
export class ExtensionStatusComponent {
  readonly available = input.required<boolean>();
  readonly collapsed = input<boolean>(false);
}