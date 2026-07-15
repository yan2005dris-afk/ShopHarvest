import { Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ExtensionService } from './services/extension.service';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';
import { ToastHostComponent } from './core/components/toast-host.component';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /**
   * `extensionAvailable` is read once on bootstrap — the
   * ExtensionService exposes it as an Observable that we bridge to
   * a local signal in the constructor. The shell only cares about
   * the latest value (no need for a live stream).
   *
   * `themeService` and `auth` are exposed directly to the template;
   * both expose signals.
   */
  extensionAvailable = false;
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  constructor(
    private readonly extensionService: ExtensionService,
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
  }
}