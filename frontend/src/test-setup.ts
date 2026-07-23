/**
 * Test setup para Vitest + Angular 22.
 * Inicializa TestBed antes de cualquier spec que lo use.
 */

/**
 * jsdom doesn't ship with ResizeObserver / MutationObserver / matchMedia.
 * boneyard-js's <SkeletonComponent> uses ResizeObserver in its
 * `ngAfterViewInit` to recompute layout on container width changes,
 * and MutationObserver to react to the dark-mode class swap on
 * <html>. We polyfill all three with no-op stubs for the test env so
 * boneyard doesn't throw ReferenceError on render.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  const polyfill = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as any).ResizeObserver = polyfill;
  if (typeof window !== 'undefined') {
    (window as any).ResizeObserver = polyfill;
  }
}

import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
if (typeof globalThis.MutationObserver === 'undefined') {
  (globalThis as { MutationObserver?: unknown }).MutationObserver = class {
    constructor(_cb: MutationCallback) {}
    observe(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
  };
}
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  // jsdom doesn't implement matchMedia; ThemeService and boneyard
  // both call it during bootstrap. Provide a minimal stub that
  // reports no matches.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
