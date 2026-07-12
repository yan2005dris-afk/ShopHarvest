import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects a route behind JWT auth.
 *
 * When the user is NOT authenticated, redirects to /login with a `returnUrl`
 * query param containing the full attempted URL (path + query string). The
 * LoginComponent reads this param and navigates back after successful auth.
 *
 * Example: `/etl-management?page=2` → `/login?returnUrl=%2Fetl-management%3Fpage%3D2`
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
