import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';
import { ToastService } from '../services/toast.service';

/**
 * Standalone in-page toast stack.
 *
 * a11y contract (WCAG 2.2 + WAI-ARIA APG "Alert" pattern):
 *   - `role="alert"` on the stack container so screen readers announce
 *     newly added toasts without moving focus.
 *   - `aria-live="assertive"` so the announcement interrupts the user
 *     even mid-speech — appropriate for error / warning severity.
 *   - Each toast has `role="alert"` + `aria-label` and a visible close
 *     button (keyboard-activatable).
 *   - `Esc` key dismisses the top-most toast (the entire stack can be
 *     cleared with multiple presses; see `clear()`).
 *   - Focus is NOT moved into the toast. The page underneath remains
 *     fully interactive — this is the non-blocking UI invariant from
 *     Spec 5 REQ-FE-5.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-stack"
      role="alert"
      aria-live="assertive"
      aria-label="Notifications"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="toast toast--{{ toast.level }}"
          role="alert"
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

  /** Esc dismisses all visible toasts. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.toasts().length > 0) {
      this.toastService.clear();
    }
  }
}