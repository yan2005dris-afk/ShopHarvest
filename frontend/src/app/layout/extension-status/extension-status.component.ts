import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-extension-status',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/setup"
      routerLinkActive="active"
      class="nav-item"
      [class.nav-item--collapsed]="collapsed()"
      [matTooltip]="collapsed() ? 'Extensión: ' + (available() ? 'ON' : 'OFF') : ''"
      matTooltipPosition="right"
    >
      <mat-icon class="nav-item__icon" aria-hidden="true">extension</mat-icon>
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
