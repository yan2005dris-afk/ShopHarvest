import { Component, DestroyRef, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
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
export class App implements OnInit, OnDestroy {
  extensionAvailable = false;
  isDark = true;
  readonly auth = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private subs: Subscription[] = [];

  constructor(
    private readonly extensionService: ExtensionService,
    readonly themeService: ThemeService,
  ) {
    // Tear down the toast service when the root component dies. The
    // service is `providedIn: 'root'`, so this hook catches hot-reload
    // and test-harness teardown where the injector is recreated.
    inject(DestroyRef).onDestroy(() => this.toastService.dispose());
  }

  ngOnInit(): void {
    this.subs.push(
      this.extensionService.available$.subscribe(v => { this.extensionAvailable = v; }),
      this.themeService.isDark$.subscribe(v => { this.isDark = v; }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
