/**
 * Development overrides — wired through `fileReplacements` in
 * `angular.json` so `environment.ts` is swapped with this file when
 * the dev server / dev build runs.
 *
 * `apiBaseUrl` is intentionally the same as production: relative
 * `/api/...` paths route through `proxy.conf.json` to
 * `http://localhost:3000` in dev. Keeping the value identical means
 * no environment-specific branches in the analytics service code.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
} as const;