import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Slice 3 / Spec 5 — global HTTP error interceptor.
 *
 * Behavior (REQ-FE-1, REQ-FE-3, REQ-FE-4):
 *   - On every HttpErrorResponse, log the full error payload to
 *     `console.error` with the six keys the frontend contract requires:
 *     statusCode, error, message, details, url, method.
 *   - On any status other than 401, surface a non-blocking toast with
 *     the backend's `message` field. The `title` and `detail` are
 *     preferred when present (RFC 7807 contract).
 *   - 401 is intentionally NOT handled here — `authInterceptor` owns
 *     the 401 path (clears vs_token + redirects to /login). Letting
 *     authInterceptor run first (it appears earlier in
 *     `withInterceptors([...])`) and re-throwing from here preserves
 *     the existing behavior with zero coupling.
 *
 * The interceptor never swallows the error — it always re-throws so
 * component-level RxJS pipelines can still branch on the failure.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      // Console logging is gated to dev builds only — in production the
      // toast gives the user feedback, and a raw console.error would
      // leak PII (request URLs, response bodies) to RUM tooling like
      // Sentry/Datadog that automatically captures console output.
      const devMode = isDevMode();

      if (!(err instanceof HttpErrorResponse)) {
        // Non-HTTP error (e.g. client-side deserialization failure).
        if (devMode) {
          console.error('[http-error] non-HTTP failure', {
            url: req.url,
            method: req.method,
            error: err,
          });
        }
        return throwError(() => err);
      }

      // 401 belongs to authInterceptor — do not toast here.
      if (err.status === 401) {
        return throwError(() => err);
      }

      // Unwrap the body. RFC 7807 envelopes carry `title` + `detail`;
      // legacy NestJS envelopes carry `message` as a string or array.
      // The body shape is loose because we accept both contracts, so
      // the interface intentionally widens `error` away from the
      // duplicate `errors` field used for per-property validation data.
      interface ErrorBody {
        type?: string;
        title?: string;
        status?: number;
        detail?: string;
        message?: string | string[];
        error?: string;
        errors?: unknown;
      }
      const body = (err.error ?? null) as ErrorBody | null;

      const consolePayload = {
        statusCode: err.status,
        error: body?.title ?? body?.error ?? err.statusText,
        message: body?.detail ?? body?.message ?? err.message,
        details: body?.errors,
        url: req.url,
        method: req.method,
      };
      if (devMode) {
        console.error('[http-error]', consolePayload);
      }

      const userMessage =
        (typeof body?.detail === 'string' && body.detail) ||
        (Array.isArray(body?.message) ? body.message.join('; ') : body?.message) ||
        err.statusText ||
        'Request failed';

      toast.show(userMessage, 'error');

      return throwError(() => err);
    }),
  );
};