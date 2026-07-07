import { Injectable, signal } from '@angular/core';

/**
 * Visible toast severity. Mirrors the four `Alert` semantic levels in
 * WAI-ARIA APG (https://www.w3.org/WAI/ARIA/apg/patterns/alert/).
 */
export type ToastLevel = 'success' | 'error' | 'warning' | 'info';

/**
 * A single in-app toast entry. `id` is used by `@for` to track the
 * element across removals; `message` is the user-facing text.
 */
export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly level: ToastLevel;
  /** Auto-dismiss countdown handle (set by `show`, cleared on manual dismiss). */
  readonly timeoutId?: ReturnType<typeof setTimeout>;
}

const DEFAULT_DURATION_MS = 5_000;

/**
 * Tiny non-blocking toast notification service.
 *
 * Why a custom service (vs `mat-snack-bar` or `Notification` API):
 *   - `@angular/material` is not a dependency; pulling it in for one
 *     notification primitive would bloat the bundle by ~150 KB gzipped.
 *   - The `Notification` browser API requires user-granted permission
 *     and shows up OUTSIDE the page chrome, which violates the spec's
 *     "non-blocking in-page" requirement.
 *
 * The service holds toasts in a signal so the host component can render
 * them reactively. The default 5-second auto-dismiss matches the spec's
 * "do not require user dismissal" guideline and respects WCAG SC 2.2.1
 * (users can extend or skip the timeout by pressing Esc, see
 * `ToastHostComponent`).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /**
   * Maximum number of toasts allowed on the stack at once. When a new
   * toast would push us over the cap, the oldest visible toast is
   * dismissed first (FIFO eviction).
   *
   * Why a cap: an unbounded stack can mask failures (a flood of 4xx
   * errors in a tight loop would pile up toasts and push the toast
   * region off-screen). Five is enough to convey "a few related
   * errors happened" while keeping the UI usable.
   */
  private static readonly MAX_TOASTS = 5;

  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 1;

  /**
   * Push a toast onto the stack.
   *
   * @param message  Human-readable text shown to the user.
   * @param level    Severity — drives the toast color/icon. Defaults to `'error'`.
   * @param durationMs  Auto-dismiss timeout in milliseconds. Default 5000.
   *                    Pass `0` to disable auto-dismiss (caller must `dismiss()`).
   */
  show(
    message: string,
    level: ToastLevel = 'error',
    durationMs: number = DEFAULT_DURATION_MS,
  ): number {
    // FIFO eviction: if the stack is already at the cap, dismiss the
    // oldest entry before pushing the new one. This keeps the visible
    // surface bounded under error storms.
    if (this._toasts().length >= ToastService.MAX_TOASTS) {
      this.dismiss(this._toasts()[0].id);
    }

    const id = this.nextId++;
    const timeoutId =
      durationMs > 0
        ? setTimeout(() => this.dismiss(id), durationMs)
        : undefined;
    const toast: Toast = { id, message, level, timeoutId };
    this._toasts.update((stack) => [...stack, toast]);
    return id;
  }

  /** Remove a toast by id. Safe to call on a toast that already timed out. */
  dismiss(id: number): void {
    const current = this._toasts();
    const target = current.find((t) => t.id === id);
    if (target?.timeoutId !== undefined) clearTimeout(target.timeoutId);
    this._toasts.update((stack) => stack.filter((t) => t.id !== id));
  }

  /** Remove every toast (used by the `Esc` handler). */
  clear(): void {
    for (const t of this._toasts()) {
      if (t.timeoutId !== undefined) clearTimeout(t.timeoutId);
    }
    this._toasts.set([]);
  }
}