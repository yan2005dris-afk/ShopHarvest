import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { NAV_ITEMS, type SidebarNavItem } from '../layout.types';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { ExtensionStatusComponent } from '../extension-status/extension-status.component';
import { LogoutComponent } from '../logout/logout.component';

/**
 * SidebarComponent — the app's left side-nav. Reusable, standalone,
 * and owned by the <app-root> shell.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatListModule,
    ThemeToggleComponent,
    ExtensionStatusComponent,
    LogoutComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['../layout.css'],
})
export class SidebarComponent {
  readonly themeService = inject(ThemeService);
  readonly auth = inject(AuthService);

  /**
   * Extension availability from <app-root> shell. The shell reads
   * it once on bootstrap from ExtensionService.available$ and passes
   * it as a plain property; we model it as a non-required input
   * here so the sidebar is testable in isolation (defaults to false).
   */
  readonly extensionAvailable = input<boolean>(false);

  /** Visible nav list — auth-gated items are filtered at render time. */
  protected readonly navItems: readonly SidebarNavItem[] = NAV_ITEMS;

  /** True if the link should be visible given the current auth state. */
  protected readonly isVisible = (item: SidebarNavItem): boolean =>
    !item.requiresAuth || this.auth.isAuthenticated();
}
