import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ExtensionService } from './services/extension.service';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { ToastHostComponent } from './core/components/toast-host.component';
import { ToastService } from './core/services/toast.service';

/**
 * App (shell root) — composes the layout primitives (sidebar,
 * main stage) around the routed page. The template lives in
 * app.html; layout primitives each live under src/app/layout/.
 *
 * - <app-sidebar> — left side-nav, collapsed/expanded via
 *   themeService.sidebarCollapsed().
 * - <main> — hosts <router-outlet>; .app-stage CSS class.
 * - <app-toast-host> — global, non-blocking toast notifications.
 *
 * The shell owns a one-shot read of extension availability (passed
 * to the sidebar as an @Input), tears down the toast service on
 * destroy, and exposes the live theme/auth signals so the sidebar
 * component doesn't need its own service subscriptions.
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    SidebarComponent,
    ToastHostComponent,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css', './layout/layout.css'],
})
export class App {
  /**
   * `extensionAvailable` is read once on bootstrap — the
   * ExtensionService exposes it as an Observable that we bridge to
   * a local signal in the constructor. The shell only cares about
   * the latest value (no need for a live stream) so the sidebar
   * receives it as plain property.
   *
   * `themeService` and `auth` are exposed directly to the template;
   * both expose signals.
   */
  extensionAvailable = false;
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  /**
   * True while the router is inside `/dashboard`. The public BI
   * dashboard owns its own full-page shell (header + tabs, no side
   * nav), so `app.html` hides `<app-sidebar>` while this is true.
   */
  readonly isDashboardRoute = signal(false);

  constructor(
    private readonly extensionService: ExtensionService,
    private readonly router: Router,
    private readonly toastService: ToastService,
  ) {
    // Tear down the toast service when the root component dies. The
    // service is `providedIn: 'root'`, so this hook catches hot-reload
    // and test-harness teardown where the injector is recreated.
    inject(DestroyRef).onDestroy(() => this.toastService.dispose());

    // One-shot read of extension availability. Subsequent changes do
    // NOT propagate to the shell — the badge is only relevant at boot.
    this.extensionService.available$.subscribe((v) => {
      this.extensionAvailable = v;
    });

    this.isDashboardRoute.set(this.router.url.startsWith('/dashboard'));
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.isDashboardRoute.set((e as NavigationEnd).urlAfterRedirects.startsWith('/dashboard'));
      });
  }
}