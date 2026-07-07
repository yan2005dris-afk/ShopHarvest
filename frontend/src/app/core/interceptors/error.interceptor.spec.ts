import { HttpErrorResponse, HttpEvent, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { vi } from 'vitest';
import { ToastService } from '../services/toast.service';
import { errorInterceptor } from './error.interceptor';

/**
 * Spec coverage (Slice 3, Spec 5 REQ-FE-2 / REQ-FE-3 / REQ-FE-4):
 *   - non-401 errors: toast.show is called, console.error receives the
 *     full envelope, and the error is re-thrown so callers can branch.
 *   - 401 errors: no toast, no console.error, error is re-thrown (the
 *     auth interceptor owns the 401 path — see auth.interceptor.ts).
 *   - The wire payload prefers RFC 7807 `detail` and `title`; falls
 *     back to legacy `message` / `error` keys for backward compat.
 */
describe('errorInterceptor', () => {
  let toastShow: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastShow = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: { show: toastShow } },
      ],
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function makeRequest(url = '/api/products') {
    // The interceptor only reads req.url / req.method, so a literal
    // HttpRequest-shaped object is enough.
    return { url, method: 'GET' } as unknown as Parameters<typeof errorInterceptor>[0];
  }

  /**
   * Drive the interceptor INSIDE the injection context so that the
   * functional `inject(ToastService)` call resolves correctly. The
   * interceptor returns the Observable; the caller subscribes later
   * (after we have left the context). subscribe() is fine because by
   * that point the interceptor has already captured the dependencies.
   */
  function invokeInterceptor(
    next: () => Observable<HttpEvent<unknown>>,
    req: Parameters<typeof errorInterceptor>[0] = makeRequest(),
  ) {
    return TestBed.runInInjectionContext(() =>
      errorInterceptor(req, next),
    );
  }

  it('shows a toast with the backend detail on 422 (validation error)', () => {
    const err = new HttpErrorResponse({
      status: 422,
      statusText: 'Unprocessable Entity',
      error: {
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'title is required',
        instance: '/api/products',
      },
    });

    return new Promise<void>((resolve, reject) => {
      invokeInterceptor(() => throwError(() => err))
        .pipe(take(1))
        .subscribe({
          next: () => reject(new Error('expected error')),
          error: (rethrown) => {
            try {
              expect(toastShow).toHaveBeenCalledWith('title is required', 'error');
              expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[http-error]',
                expect.objectContaining({
                  statusCode: 422,
                  error: 'Unprocessable Entity',
                  message: 'title is required',
                  url: '/api/products',
                  method: 'GET',
                }),
              );
              expect(rethrown).toBe(err);
              resolve();
            } catch (e) {
              reject(e as Error);
            }
          },
        });
    });
  });

  it('falls back to backend message[] joined with semicolons', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        message: ['email must be an email', 'password too short'],
      },
    });

    return new Promise<void>((resolve, reject) => {
      invokeInterceptor(() => throwError(() => err))
        .pipe(take(1))
        .subscribe({
          next: () => reject(new Error('expected error')),
          error: () => {
            try {
              expect(toastShow).toHaveBeenCalledWith(
                'email must be an email; password too short',
                'error',
              );
              resolve();
            } catch (e) {
              reject(e as Error);
            }
          },
        });
    });
  });

  it('does NOT show a toast or console.error on 401 (auth owns 401)', () => {
    const err = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });

    return new Promise<void>((resolve, reject) => {
      invokeInterceptor(() => throwError(() => err))
        .pipe(take(1))
        .subscribe({
          next: () => reject(new Error('expected error')),
          error: () => {
            try {
              expect(toastShow).not.toHaveBeenCalled();
              expect(consoleErrorSpy).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e as Error);
            }
          },
        });
    });
  });

  it('logs non-HTTP failures with a generic payload', () => {
    const weird = new Error('deserialization exploded');

    return new Promise<void>((resolve, reject) => {
      invokeInterceptor(() => throwError(() => weird))
        .pipe(take(1))
        .subscribe({
          next: () => reject(new Error('expected error')),
          error: () => {
            try {
              expect(toastShow).not.toHaveBeenCalled();
              expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[http-error] non-HTTP failure',
                expect.objectContaining({ url: '/api/products', method: 'GET' }),
              );
              resolve();
            } catch (e) {
              reject(e as Error);
            }
          },
        });
    });
  });

  it('passes successful responses through untouched', () => {
    const ok = new HttpResponse({ status: 200, body: { ok: true } });

    return new Promise<void>((resolve, reject) => {
      invokeInterceptor(() => of(ok)).subscribe({
        next: (value) => {
          try {
            expect(value).toBe(ok);
            expect(toastShow).not.toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        },
        error: reject,
      });
    });
  });
});