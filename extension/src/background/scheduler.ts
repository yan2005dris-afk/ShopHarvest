// ── Auto-replay scheduler (review batch 5) ────────────────────────────────────
//
// Option A (reactive) from docs/REVIEW-2026-07-03.md §S1. A per-domain
// chrome.alarm fires on the user's chosen interval. When it fires, if the user
// currently has a tab open on that domain, the extension re-runs the saved
// fieldMappings on that page — in the user's real session, so no captcha — and
// posts the results to the backend. If no matching tab is open, the run is
// skipped until the next tick. The schedule lives client-side in
// chrome.storage.local; the backend no longer owns a schedule table.

import { ALLOWED_BACKEND_ORIGINS, DEFAULT_BACKEND_URL } from '../config';

const ALARM_PREFIX = 'replay:';

export interface ScheduleEntry {
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: number | null;
}

type Schedules = Record<string, ScheduleEntry>;

/** Rule shape the content script's EXTRACT handler expects. */
interface ExtDomainRule {
  domain: string;
  containerSelector: string;
  fieldMappings: unknown[];
  createdAt: number;
  updatedAt: number;
}

type RawProduct = Record<string, string | number | null>;

// ── Storage ───────────────────────────────────────────────────────────────────

async function getSchedules(): Promise<Schedules> {
  const { schedules } = await chrome.storage.local.get('schedules');
  return (schedules as Schedules) ?? {};
}

async function setSchedules(schedules: Schedules): Promise<void> {
  await chrome.storage.local.set({ schedules });
}

async function getBackendUrl(): Promise<string> {
  const { backendUrl } = await chrome.storage.local.get('backendUrl');
  const normalized =
    typeof backendUrl === 'string' ? normalizeBackendUrl(backendUrl) : null;
  return normalized ?? DEFAULT_BACKEND_URL;
}

/**
 * Validate + canonicalize an URL for the backend. Returns `null` for
 * anything that is not a well-formed http(s) URL on an allowlisted origin
 * (rejects `file:`, `ftp:`, `javascript:`, malformed origin, and any host
 * outside `ALLOWED_BACKEND_ORIGINS` — see `config.ts` for why), and strips
 * a trailing slash so `getBackendUrl()` + `${base}/products/ingest` never
 * double-slash. Pure → unit-testable without `chrome.*` globals.
 */
export function normalizeBackendUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!ALLOWED_BACKEND_ORIGINS.includes(url.origin)) return null;
  return url.toString().replace(/\/$/, '');
}

/**
 * Persist a per-install backend URL override. Callers go through this so
 * the value is validated and canonicalized before it lands in
 * chrome.storage.local. Returns false (and stores nothing) on bad input.
 */
export async function setBackendUrl(input: string): Promise<boolean> {
  const normalized = normalizeBackendUrl(input);
  if (!normalized) return false;
  await chrome.storage.local.set({ backendUrl: normalized });
  return true;
}

/** JWT handed over by the Angular app after login (batch 6). */
async function getAuthToken(): Promise<string | null> {
  const { authToken } = await chrome.storage.local.get('authToken');
  return typeof authToken === 'string' && authToken.length > 0 ? authToken : null;
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Alarms ──────────────────────────────────────────────────────────────────

function alarmName(domain: string): string {
  return ALARM_PREFIX + domain;
}

async function applyAlarm(domain: string, entry: ScheduleEntry): Promise<void> {
  await chrome.alarms.clear(alarmName(domain));
  if (entry.enabled && entry.intervalMinutes > 0) {
    chrome.alarms.create(alarmName(domain), {
      periodInMinutes: entry.intervalMinutes,
    });
  }
}

async function upsertSchedule(
  domain: string,
  intervalMinutes: number,
  enabled: boolean,
): Promise<ScheduleEntry> {
  const schedules = await getSchedules();
  const entry: ScheduleEntry = {
    intervalMinutes,
    enabled,
    lastRunAt: schedules[domain]?.lastRunAt ?? null,
  };
  schedules[domain] = entry;
  await setSchedules(schedules);
  await applyAlarm(domain, entry);
  return entry;
}

/** Re-register alarms from stored schedules (idempotent; runs on start/install). */
async function rearmAll(): Promise<void> {
  const schedules = await getSchedules();
  for (const [domain, entry] of Object.entries(schedules)) {
    await applyAlarm(domain, entry);
  }
}

// ── Replay ────────────────────────────────────────────────────────────────────

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function findTabForDomain(domain: string): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({});
  return (
    tabs.find((tab) => {
      const host = hostOf(tab.url);
      return host === domain || (host !== null && host.endsWith('.' + domain));
    }) ?? null
  );
}

async function fetchRule(domain: string): Promise<ExtDomainRule | null> {
  const base = await getBackendUrl();
  const token = await getAuthToken();
  const res = await fetch(`${base}/domains?host=${encodeURIComponent(domain)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return null;
  const rules = (await res.json()) as Array<{
    domain: string;
    containerSelector?: string | null;
    fieldMappings?: unknown[] | null;
  }>;
  const rule = rules[0];
  if (!rule) return null;
  return {
    domain: rule.domain,
    containerSelector: rule.containerSelector ?? '',
    fieldMappings: rule.fieldMappings ?? [],
    createdAt: 0,
    updatedAt: 0,
  };
}

async function runReplay(domain: string): Promise<void> {
  const schedules = await getSchedules();
  const entry = schedules[domain];
  if (!entry || !entry.enabled) return;

  const tab = await findTabForDomain(domain);
  if (!tab || tab.id === undefined) {
    console.info(`[scheduler] no open tab for ${domain}; skipping replay`);
    return;
  }

  const rule = await fetchRule(domain);
  if (!rule || rule.fieldMappings.length === 0) {
    console.warn(`[scheduler] no saved rule for ${domain}; skipping replay`);
    return;
  }

  let products: RawProduct[] = [];
  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT',
      payload: rule,
    })) as { products?: RawProduct[] } | undefined;
    products = response?.products ?? [];
  } catch (err) {
    console.warn(`[scheduler] EXTRACT failed for ${domain}:`, err);
    return;
  }

  // The ingest DTO rejects an empty product array, so skip a no-op post.
  if (products.length === 0) {
    console.info(`[scheduler] replay for ${domain} extracted 0 products`);
    return;
  }

  const base = await getBackendUrl();
  const token = await getAuthToken();
  const ok = await postIngest(base, token, {
    domain,
    pageUrl: tab.url,
    fieldMappings: rule.fieldMappings,
    products,
  });
  if (!ok) {
    // postIngest already logged the warning. Do NOT stamp lastRunAt —
    // a 401/400/500 means the run did not actually complete.
    return;
  }

  entry.lastRunAt = Date.now();
  schedules[domain] = entry;
  await setSchedules(schedules);
  console.info(`[scheduler] replayed ${products.length} products for ${domain}`);
}

/**
 * POST the extracted products to the backend ingest endpoint. Returns true on
 * a 2xx response, false otherwise (network error OR non-OK HTTP status). A
 * non-OK response must NOT count as a successful replay — otherwise a 401 or
 * 500 silently poisons the schedule and the next tick is never triggered.
 *
 * Exported for unit testing — does not depend on `chrome.*` globals.
 */
export async function postIngest(
  baseUrl: string,
  token: string | null,
  body: {
    domain: string;
    pageUrl?: string;
    fieldMappings: unknown[];
    products: RawProduct[];
  },
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/products/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(
        `[scheduler] ingest returned ${res.status} for ${body.domain}; not marking replay as success`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[scheduler] ingest fetch failed for ${body.domain}:`, err);
    return false;
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────────

/**
 * Register alarm, lifecycle, and Angular-facing message listeners. Called once
 * from the service worker. The Angular app configures schedules via
 * `chrome.runtime.sendMessage(extensionId, { type: 'SET_SCHEDULE', ... })`.
 */
export function initScheduler(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith(ALARM_PREFIX)) return;
    void runReplay(alarm.name.slice(ALARM_PREFIX.length));
  });

  chrome.runtime.onStartup.addListener(() => void rearmAll());
  chrome.runtime.onInstalled.addListener(() => void rearmAll());

  chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    const { type, payload } = (message ?? {}) as { type?: string; payload?: unknown };

    if (type === 'SET_SCHEDULE') {
      const { domain, intervalMinutes, enabled } = (payload ?? {}) as {
        domain?: string;
        intervalMinutes?: number;
        enabled?: boolean;
      };
      if (!domain || typeof intervalMinutes !== 'number') {
        sendResponse({ ok: false, error: 'domain and intervalMinutes are required' });
        return true;
      }
      void upsertSchedule(domain, intervalMinutes, enabled ?? true).then((entry) =>
        sendResponse({ ok: true, entry }),
      );
      return true;
    }

    if (type === 'GET_SCHEDULES') {
      void getSchedules().then((schedules) => sendResponse({ ok: true, schedules }));
      return true;
    }

    if (type === 'SET_AUTH_TOKEN') {
      const { token } = (payload ?? {}) as { token?: string };
      void chrome.storage.local
        .set({ authToken: token ?? '' })
        .then(() => sendResponse({ ok: true }));
      return true;
    }

    if (type === 'SET_BACKEND_URL') {
      const { url } = (payload ?? {}) as { url?: string };
      if (typeof url !== 'string') {
        sendResponse({
          ok: false,
          error: 'backendUrl must be an allowed http(s) URL',
        });
        return true;
      }
      void setBackendUrl(url).then((ok) =>
        sendResponse(
          ok
            ? { ok: true }
            : { ok: false, error: 'backendUrl must be an allowed http(s) URL' },
        ),
      );
      return true;
    }

    return false;
  });
}
