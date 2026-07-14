import { Injectable, signal, effect, computed } from '@angular/core';

/**
 * Resolves theme-aware token values for ApexCharts and other
 * JavaScript-driven widgets.
 *
 * Reads CSS custom properties off `<html>` (set in `styles.css`) so
 * the chart palette tracks the same theme switch used by the rest of
 * the dashboard. Returns hex fallbacks if the variables are absent
 * (SSR / tests).
 *
 * Usage:
 *   const tokens = this.theme.charts();
 *   const cfg = { foreColor: tokens.foreColor, grid: { borderColor: tokens.grid } };
 */
@Injectable({ providedIn: 'root' })
export class ThemeTokenService {
  private readonly _currentTheme = signal<'light' | 'dark'>(this.detect());

  /** Computed token bundle for charts, re-read on every theme change. */
  readonly charts = computed(() => {
    const theme = this._currentTheme();
    return {
      theme,
      foreColor: this.resolve('--text-2', theme === 'dark' ? '#cbd5e1' : '#4a5180'),
      labelColor: this.resolve('--text-1', theme === 'dark' ? '#f8fafc' : '#1a1d2e'),
      grid: this.resolve(
        '--border',
        theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e2e6f4',
      ),
      accent: this.resolve(
        '--accent',
        theme === 'dark' ? '#60a5fa' : '#5b4fc8',
      ),
      accent2: this.resolve(
        '--accent-2',
        theme === 'dark' ? '#a78bfa' : '#7c6fcd',
      ),
      success: this.resolve('--success', theme === 'dark' ? '#34d399' : '#16a34a'),
      warning: this.resolve('--warning', theme === 'dark' ? '#fbbf24' : '#d97706'),
      danger: this.resolve('--danger', theme === 'dark' ? '#fb7185' : '#dc2626'),
    };
  });

  /** Active theme label (`'light'` | `'dark'`). */
  readonly current = computed(() => this._currentTheme());

  constructor() {
    // Re-detect on theme attribute changes and prefers-color-scheme changes.
    if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const root = document.documentElement;
      const observer = new MutationObserver(() => {
        this._currentTheme.set(this.detect());
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener?.('change', () => this._currentTheme.set(this.detect()));
    }
    // Effect to log on theme change (useful when debugging theme mismatches).
    effect(() => {
      const t = this._currentTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-resolved-theme', t);
      }
    });
  }

  /** Force re-detection (call after toggling the theme). */
  refresh(): void {
    this._currentTheme.set(this.detect());
  }

  private detect(): 'light' | 'dark' {
    if (typeof document === 'undefined') return 'dark';
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }

  private resolve(varName: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(varName).trim();
    return value || fallback;
  }
}
