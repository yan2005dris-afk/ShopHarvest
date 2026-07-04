// ── Auto-replay scheduler (review batch 5) ────────────────────────────────────
//
// Option A (reactive) from docs/REVIEW-2026-07-03.md §S1. A per-domain
// chrome.alarm fires on the user's chosen interval. When it fires, if the user
// currently has a tab open on that domain, the extension re-runs the saved
// fieldMappings on that page — in the user's real session, so no captcha — and
// posts the results to the backend. If no matching tab is open, the run is
// skipped until the next tick. The schedule lives client-side in
// chrome.storage.local; the backend no longer owns a schedule table.

const ALARM_PREFIX = 'replay:';
const DEFAULT_BACKEND_URL = 'http://localhost:3000';

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
  return typeof backendUrl === 'string' && backendUrl.length > 0
    ? backendUrl
    : DEFAULT_BACKEND_URL;
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
  try {
    await fetch(`${base}/products/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({
        domain,
        pageUrl: tab.url,
        fieldMappings: rule.fieldMappings,
        products,
      }),
    });
  } catch (err) {
    console.warn(`[scheduler] ingest failed for ${domain}:`, err);
    return;
  }

  entry.lastRunAt = Date.now();
  schedules[domain] = entry;
  await setSchedules(schedules);
  console.info(`[scheduler] replayed ${products.length} products for ${domain}`);
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

    return false;
  });
}
