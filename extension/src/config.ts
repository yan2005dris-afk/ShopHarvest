// ── Backend origin config ────────────────────────────────────────────────────
//
// The API is served under the same origin as the web app with the `api`
// global prefix (see `backend/src/main.ts` and `frontend/src/environments`).
// `ALLOWED_BACKEND_ORIGINS` mirrors `host_permissions` in `manifest.json`:
// `normalizeBackendUrl()` in `background/scheduler.ts` rejects any origin
// outside this list, even a well-formed http(s) URL, so a compromised
// `externally_connectable` caller (see `manifest.json`) can't redirect
// replay traffic — including the JWT it carries — to an attacker host.
//
// Dev setups override the default per install via
// `chrome.storage.local.backendUrl` (the `SET_BACKEND_URL` message), which
// is why `http://localhost:3000` is allowlisted alongside prod.

export const DEFAULT_BACKEND_URL = 'https://bi.dihm-muertos.site/api';

export const ALLOWED_BACKEND_ORIGINS: readonly string[] = [
  'https://bi.dihm-muertos.site',
  'http://localhost:3000',
];
