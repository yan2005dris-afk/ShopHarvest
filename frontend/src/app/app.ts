import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { ExtensionService } from './services/extension.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  extensionAvailable = false;
  isDark = true;
  private subs: Subscription[] = [];

  constructor(
    private readonly extensionService: ExtensionService,
    readonly themeService: ThemeService,
  ) {}

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
