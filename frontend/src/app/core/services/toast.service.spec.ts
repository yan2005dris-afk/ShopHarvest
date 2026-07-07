import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

/**
 * Spec for the toast notification service.
 *
 * Covers the public API surface that callers depend on:
 *   - `show()` returns a numeric id that increments per push
 *   - auto-dismiss fires after `durationMs`
 *   - `dismiss(id)` is a no-op on already-timed-out toasts
 *   - `clear()` cancels every pending timer and empties the signal
 *   - `durationMs: 0` schedules no timer (manual dismiss only)
 *   - pushing past `MAX_TOASTS` evicts the oldest (FIFO)
 *
 * Timer behavior uses `vi.useFakeTimers()` so we can advance the clock
 * deterministically without waiting wall-clock time.
 */
describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    // Belt-and-suspenders: clear any timers that survived a test and
    // restore real timers so the next test starts clean.
    service.clear();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('show() returns incrementing ids', () => {
    const id1 = service.show('one');
    const id2 = service.show('two');
    const id3 = service.show('three');

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(id3).toBe(3);
    expect(service.toasts().length).toBe(3);
  });

  it('auto-dismisses a toast after durationMs', () => {
    vi.useFakeTimers();
    service.show('auto', 'info', 1_000);

    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(999);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('dismiss(id) on an already-timed-out toast is a no-op', () => {
    vi.useFakeTimers();
    const id = service.show('transient', 'info', 500);

    vi.advanceTimersByTime(500);
    expect(service.toasts().length).toBe(0);

    // Calling dismiss again should not throw and should not resurrect
    // the toast or otherwise mutate state.
    expect(() => service.dismiss(id)).not.toThrow();
    expect(service.toasts().length).toBe(0);
  });

  it('clear() cancels every pending timer and empties the signal', () => {
    vi.useFakeTimers();
    service.show('a', 'info', 5_000);
    service.show('b', 'info', 5_000);
    service.show('c', 'info', 5_000);

    expect(service.toasts().length).toBe(3);

    service.clear();

    expect(service.toasts().length).toBe(0);

    // Even after the original 5s timer would have fired, no toast
    // reappears (because clear() called clearTimeout).
    vi.advanceTimersByTime(10_000);
    expect(service.toasts().length).toBe(0);
  });

  it('durationMs: 0 schedules no timer (caller must dismiss manually)', () => {
    vi.useFakeTimers();
    service.show('manual-only', 'info', 0);

    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(60_000);
    expect(service.toasts().length).toBe(1);

    const id = service.toasts()[0].id;
    service.dismiss(id);
    expect(service.toasts().length).toBe(0);
  });

  it('evicts the oldest toast (FIFO) when MAX_TOASTS is reached', () => {
    // MAX_TOASTS is private; we drive it by pushing past the cap.
    // Six pushes on a cap of five must leave exactly five toasts on
    // the stack and the very first message must be gone.
    service.show('one', 'info', 0);
    service.show('two', 'info', 0);
    service.show('three', 'info', 0);
    service.show('four', 'info', 0);
    service.show('five', 'info', 0);
    service.show('six', 'info', 0);

    const messages = service.toasts().map((t) => t.message);
    expect(service.toasts().length).toBe(5);
    expect(messages).toEqual(['two', 'three', 'four', 'five', 'six']);
  });

  it('success/error/warning/info shorthands push with the right severity', () => {
    service.success('saved');
    service.error('boom');
    service.warning('careful');
    service.info('fyi');

    const levels = service.toasts().map((t) => t.level);
    expect(levels).toEqual(['success', 'error', 'warning', 'info']);
  });
});