import { Injectable, signal, computed } from '@angular/core';

/**
 * ThemeService — owns two pieces of persisted UI state:
 *
 *   1. `isDark` (theme) — flips `class="dark"` on <html>. Tailwind v4's
 *      `@variant dark { ... }` block in styles.css swaps the Material 3
 *      palette. Persistence: localStorage 'theme' ∈ {'dark','light'}.
 *      Default follows `prefers-color-scheme` when nothing is saved.
 *
 *   2. `sidebarCollapsed` — UI affordance: sidebar collapses from
 *      240px (full) to 64px (icons only). Persistence: localStorage
 *      'sidebar-collapsed' ∈ {'1',''}. Default expanded on desktop,
 *      collapsed on viewport < 1024px.
 *
 * Both signals are exposed directly (no BehaviorSubject) — Angular 22
 * + signals + zoneless change detection lets the template read them
 * with `isDark()` / `sidebarCollapsed()` and re-render without any
 * observable plumbing.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'theme';
  private readonly SIDEBAR_KEY = 'sidebar-collapsed';

  private readonly _isDark = signal<boolean>(this.resolveInitialDark());
  private readonly _sidebarCollapsed = signal<boolean>(this.resolveInitialSidebar());

  /** Current theme — true = dark, false = light. */
  readonly isDark = this._isDark.asReadonly();

  /** Sidebar collapsed (icons only) vs expanded (full nav). */
  readonly sidebarCollapsed = this._sidebarCollapsed.asReadonly();

  /** Material Symbols icon name shown next to the theme toggle button. */
  readonly themeIcon = computed(() => (this._isDark() ? 'light_mode' : 'dark_mode'));

  constructor() {
    // Apply initial state to <html> on boot.
    this.applyThemeClass(this._isDark());
  }

  toggleTheme(): void {
    this.setDark(!this._isDark());
  }

  setDark(dark: boolean): void {
    this._isDark.set(dark);
    this.applyThemeClass(dark);
    localStorage.setItem(this.THEME_KEY, dark ? 'dark' : 'light');
  }

  toggleSidebar(): void {
    this.setSidebarCollapsed(!this._sidebarCollapsed());
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this._sidebarCollapsed.set(collapsed);
    localStorage.setItem(this.SIDEBAR_KEY, collapsed ? '1' : '');
  }

  // ─── private helpers ──────────────────────────────────────────

  /**
   * Theme bootstrap order:
   *   1. localStorage['theme'] explicit user choice wins
   *   2. `prefers-color-scheme: dark` from the OS
   *   3. Default to light (Material 3 / Insight Flow primary look)
   */
  private resolveInitialDark(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const saved = localStorage.getItem(this.THEME_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Sidebar bootstrap:
   *   1. localStorage explicit user choice wins
   *   2. Mobile-first: collapsed if viewport is narrow (< 1024px)
   *   3. Desktop default: expanded
   */
  private resolveInitialSidebar(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const saved = localStorage.getItem(this.SIDEBAR_KEY);
    if (saved === '1') return true;
    if (saved === '') return false;
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  private applyThemeClass(dark: boolean): void {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
  }
}
