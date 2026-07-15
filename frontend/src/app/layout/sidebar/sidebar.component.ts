import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { NAV_ITEMS, type SidebarNavItem } from '../layout.types';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { ExtensionStatusComponent } from '../extension-status/extension-status.component';

/**
 * SidebarComponent — the app's left side-nav. Reusable, standalone,
 * and owned by the <app-root> shell.
 *
 * Structure (top → bottom):
 *   1. Brand row       — logo icon + "Scraper Studio / BI Analytics
 *                        Engine" caption (caption hides when collapsed).
 *   2. Collapse toggle — top-right of the brand row.
 *   3. Nav            — <app-sidebar> renders each NAV_ITEM as a
 *                        routerLink with the Material Symbols icon
 *                        and label. Filtered by `requiresAuth` and
 *                        `auth.isAuthenticated()`.
 *   4. Footer         — theme toggle + extension status.
 *
 * The collapse/expand state lives in ThemeService (signal-driven
 * + localStorage-persisted) so other components can react to it.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    ExtensionStatusComponent,
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
