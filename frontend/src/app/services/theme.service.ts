import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'theme';
  private readonly _isDark = new BehaviorSubject<boolean>(true);

  readonly isDark$ = this._isDark.asObservable();

  get isDark(): boolean {
    return this._isDark.value;
  }

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved !== null ? saved === 'dark' : prefersDark;
    this.apply(dark);
  }

  toggle(): void {
    this.apply(!this._isDark.value);
  }

  private apply(dark: boolean): void {
    this._isDark.next(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
  }
}
