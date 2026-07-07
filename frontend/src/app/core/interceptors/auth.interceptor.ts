import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';

/**
 * Returns true when the request URL should receive the Bearer token. We
 * scope the JWT to /api/* so that external URLs (CDNs, third-party APIs,
 * analytics endpoints) never carry the credential — that would leak it
 * via intermediate proxies and into request logs the user never saw.
 */
function isScopedApiRequest(url: string): boolean {
  // Same-origin relative paths only: "/api/..." matches; absolute URLs
  // (https://cdn...) and other same-origin paths do not.
  return url.startsWith('/api/');
}

/**
 * Attaches the JWT as a Bearer token to /api/ requests and, on a 401,
 * clears the session and bounces the user to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token;
  const authReq =
    token && isScopedApiRequest(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
