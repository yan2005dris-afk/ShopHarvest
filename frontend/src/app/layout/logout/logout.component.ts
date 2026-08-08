import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <button
      type="button"
      class="nav-item nav-item--button w-full"
      [class.nav-item--collapsed]="collapsed()"
      (click)="onClick()"
      data-testid="btn-logout"
      [attr.aria-label]="'Cerrar sesión'"
      [matTooltip]="collapsed() ? 'Cerrar sesión' : ''"
      matTooltipPosition="right"
    >
      <mat-icon class="nav-item__icon" aria-hidden="true">logout</mat-icon>
      @if (!collapsed()) {
        <span class="nav-item__label">Cerrar sesión</span>
      }
    </button>
  `,
})
export class LogoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  /** Sidebar collapse state — affects icon-only vs icon+label rendering. */
  readonly collapsed = input<boolean>(false);

  /** Only show the entry when the user actually has a session. */
  protected readonly visible = computed(() => this.auth.isAuthenticated());

  protected onClick(): void {
    // Side-effect: clear token, then navigate. The authGuard in
    // app.routes.ts redirects unauthenticated users away from
    // protected pages, so this navigation is what makes the
    // current page bounce to /login on next render.
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
