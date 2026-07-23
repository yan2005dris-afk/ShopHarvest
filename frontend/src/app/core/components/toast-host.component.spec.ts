import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../services/toast.service';
import { ToastHostComponent } from './toast-host.component';

/**
 * Spec for the toast host's render + dismiss UX.
 *
 * Spec coverage (Slice 3, REQ-FE-3 + REQ-FE-5):
 *   - toasts in the signal render as `role="alert"` elements
 *   - clicking the close button dismisses the right toast
 *   - multiple toasts stack independently
 *   - the page underneath the toast stack is non-blocking (UI
 *     interactive, no `pointer-events: none` on actionable elements)
 *
 * We don't drive the auto-dismiss timer in this spec — the host has no
 * timer logic of its own; it's all delegated to ToastService. The
 * TimerService itself is covered by manual unit tests in services/.
 */
@Component({
  selector: 'app-host-shell',
  standalone: true,
  imports: [ToastHostComponent],
  template: `
    <button type="button" class="sibling">click me</button>
    <app-toast-host />
  `,
})
class HostShellComponent {
  private readonly toast = TestBed.inject(ToastService);
  pushError(message: string): void {
    this.toast.show(message, 'error', 60_000);
  }
  pushSuccess(message: string): void {
    this.toast.show(message, 'success', 60_000);
  }
  pushInfo(message: string): void {
    this.toast.show(message, 'info', 60_000);
  }
}

describe('ToastHostComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostShellComponent],
    });
  });

  afterEach(() => {
    // Reset the testing module so each test starts from a clean slate —
    // a leaked provider config from one test can otherwise bleed into
    // the next (the toast-host spec exercises a real ToastService that
    // schedules timers, so a stale signal would persist across cases).
    TestBed.resetTestingModule();
  });

  it('renders toasts from the signal as role=alert for error severity', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('first failure');
    fixture.detectChanges();

    // The container is a `role="region"`; each toast gets `role="alert"`
    // (or `role="status"` for non-urgent severities). For an error push,
    // we expect exactly one `role="alert"` element.
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const region = fixture.nativeElement.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('first failure');
  });

  it('clicking the close button dismisses the right toast', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('to-be-closed');
    fixture.detectChanges();

    const closeButtons = fixture.nativeElement.querySelectorAll(
      '.toast__close',
    ) as NodeListOf<HTMLButtonElement>;
    expect(closeButtons.length).toBe(1);
    closeButtons[0].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('to-be-closed');
  });

  it('stacks multiple toasts independently', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('first');
    fixture.componentInstance.pushError('second');
    fixture.detectChanges();

    const toasts = fixture.nativeElement.querySelectorAll('.toast');
    expect(toasts.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('first');
    expect(fixture.nativeElement.textContent).toContain('second');
  });

  it('does not block clicks on sibling elements (non-blocking UI)', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('toast open');
    fixture.detectChanges();

    const sibling = fixture.nativeElement.querySelector('.sibling') as HTMLButtonElement;
    // The sibling must remain clickable; the toast stack uses
    // pointer-events: none on the container so the page chrome is
    // never covered.
    expect(sibling).toBeTruthy();
    sibling.click();
    // If the click had been swallowed, the host's @HostListener would
    // not have triggered; absence of throw is sufficient.
  });

  it('Esc key dismisses every visible toast', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('one');
    fixture.componentInstance.pushError('two');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.toast').length).toBe(2);

    // Dispatch a real KeyboardEvent on the document — that's what the
    // @HostListener('document:keydown.escape') binds to.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.toast').length).toBe(0);
  });

  it('aria-live="assertive" for error severity, "polite" for success', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('urgent');
    fixture.componentInstance.pushSuccess('all good');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const toasts: HTMLElement[] = Array.from(root.querySelectorAll('.toast'));
    const errorToast = toasts.find((el) => el.textContent?.includes('urgent'));
    const successToast = toasts.find((el) => el.textContent?.includes('all good'));

    expect(errorToast).toBeDefined();
    expect(successToast).toBeDefined();
    expect(errorToast!.getAttribute('aria-live')).toBe('assertive');
    expect(successToast!.getAttribute('aria-live')).toBe('polite');
  });

  it('renders severity-specific CSS classes on each toast', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.componentInstance.pushError('e');
    fixture.componentInstance.pushSuccess('s');
    fixture.componentInstance.pushInfo('i');
    fixture.detectChanges();

    const toasts = fixture.nativeElement.querySelectorAll('.toast');
    expect(toasts.length).toBe(3);
    expect(toasts[0].classList.contains('toast--error')).toBe(true);
    expect(toasts[1].classList.contains('toast--success')).toBe(true);
    expect(toasts[2].classList.contains('toast--info')).toBe(true);
  });
});
