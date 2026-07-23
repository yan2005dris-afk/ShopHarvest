import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { ToastService, ToastLevel } from '../services/toast.service';

/**
 * Standalone in-page toast stack.
 *
 * a11y contract (WCAG 2.2 + WAI-ARIA APG "Alert" pattern):
 *   - `role="region"` on the stack container so screen readers
 *     announce newly added toasts without moving focus (an outer
 *     `role="alert"` would also flag every nested item as alert —
 *     nested alerts are undefined ARIA and screen readers handle them
 *     inconsistently).
 *   - `aria-live="polite"` on the container, then per-toast
 *     `aria-live="assertive"` for `error`/`warning` and `"polite"` for
 *     `success`/`info` — matches the urgency of each severity.
 *   - Each toast has `role="alert"` (or `role="status"` for non-urgent
 *     severities) + `aria-label` and a visible close button
 *     (keyboard-activatable).
 *   - `Esc` clears all visible toasts in one press.
 *   - Focus is NOT moved into the toast. The page underneath remains
 *     fully interactive — this is the non-blocking UI invariant from
 *     Spec 5 REQ-FE-5.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" role="region" aria-label="Notifications">
      @for (toast of toasts(); track toast.id) {
        <div
          class="toast toast--{{ toast.level }}"
          [attr.role]="roleFor(toast.level)"
          [attr.aria-live]="ariaLiveFor(toast.level)"
          [attr.data-toast-id]="toast.id"
        >
          <span class="toast__message">{{ toast.message }}</span>
          <button
            type="button"
            class="toast__close"
            aria-label="Dismiss notification"
            (click)="onDismiss(toast.id)"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.component.css',
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  onDismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  /**
   * ARIA role per severity:
   *   - `error` / `warning` → `alert` (urgent, interrupts the user)
   *   - `success` / `info`  → `status` (non-urgent advisory message)
   */
  roleFor(level: ToastLevel): 'alert' | 'status' {
    return level === 'error' || level === 'warning' ? 'alert' : 'status';
  }

  /**
   * ARIA live region politeness per severity:
   *   - `error` / `warning` → `assertive` (announces immediately)
   *   - `success` / `info`  → `polite` (waits for idle screen reader)
   */
  ariaLiveFor(level: ToastLevel): 'assertive' | 'polite' {
    return level === 'error' || level === 'warning' ? 'assertive' : 'polite';
  }

  /** Esc dismisses the entire visible stack in a single press. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.toasts().length > 0) {
      this.toastService.clear();
    }
  }
}
