import { Injectable, computed, inject } from '@angular/core';
import { ThemeService } from '../../../services/theme.service';

/**
 * Resolves theme-aware token values for ApexCharts and other
 * JavaScript-driven widgets.
 *
 * Reads the real Insight Flow `--color-*` custom properties off
 * `<html>` (defined in `styles.css`) and tracks `ThemeService.isDark()`
 * — the same `.dark` class toggle the sidebar uses — so chart colors
 * stay in sync with the rest of the app. Returns hex fallbacks if the
 * variables are absent (SSR / tests).
 *
 * Usage:
 *   const tokens = this.theme.charts();
 *   const cfg = { foreColor: tokens.foreColor, grid: { borderColor: tokens.grid } };
 */
@Injectable({ providedIn: 'root' })
export class ThemeTokenService {
  private readonly themeService = inject(ThemeService);

  /** Computed token bundle for charts, re-read on every theme change. */
  readonly charts = computed(() => {
    const dark = this.themeService.isDark();
    const theme = dark ? 'dark' : 'light';
    return {
      theme,
      foreColor: this.resolve('--color-on-surface-variant', dark ? '#c7c4d7' : '#464554'),
      labelColor: this.resolve('--color-on-surface', dark ? '#e3e2ec' : '#111c2d'),
      grid: this.resolve('--color-outline-variant', dark ? '#464554' : '#c7c4d7'),
      accent: this.resolve('--color-primary', dark ? '#b6b8ff' : '#4648d4'),
      accent2: this.resolve('--color-secondary', dark ? '#b8c4ff' : '#4b5a9c'),
      success: this.resolve('--color-success', '#10b981'),
      warning: this.resolve('--color-warning', '#f59e0b'),
      danger: this.resolve('--color-danger', '#ef4444'),
    };
  });

  /** Active theme label (`'light'` | `'dark'`). */
  readonly current = computed(() => (this.themeService.isDark() ? 'dark' : 'light'));

  private resolve(varName: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(varName).trim();
    return value || fallback;
  }
}
