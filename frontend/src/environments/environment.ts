/**
 * Production-like defaults — used as the TypeScript default when no file
 * replacement is configured.
 *
 * `apiBaseUrl` stays RELATIVE ("/api/...") so the browser sends the
 * request to the same origin it was loaded from. In dev that hits the
 * `proxy.conf.json` upstream; in production the same path is served by
 * the reverse proxy in front of the Angular bundle and NestJS API.
 * Hard-coding an absolute origin here would break both environments.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
} as const;