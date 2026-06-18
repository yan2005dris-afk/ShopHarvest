import type {
  DomainRule,
  ExtractedProduct,
  FieldMapping,
  Message,
  MappingSession,
  PortInbound,
  StorageData,
} from '../types';

// ── Active mapping session (one at a time) ────────────────────────────────────

let activeSession: MappingSession | null = null;

// ── Port-based connection from Angular frontend ───────────────────────────────

chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name !== 'mapping-session') return;

  port.onMessage.addListener(async (msg: PortInbound) => {
    if (msg.type !== 'OPEN_MAPPER') return;

    const { url } = msg.payload as { url: string };

    // Close previous session if any
    if (activeSession) {
      chrome.tabs.remove(activeSession.scrapingTabId).catch(() => {});
      activeSession = null;
    }

    try {
      const tab = await chrome.tabs.create({ url, active: true });
      if (!tab.id) throw new Error('Tab creation failed');

      activeSession = { scrapingTabId: tab.id, port, mappings: {} };

      // Wait for tab to finish loading, then start mapping mode
      waitForTabLoad(tab.id, () => {
        chrome.tabs.sendMessage(tab.id!, {
          type: 'START_MAPPING',
          payload: { fromFrontend: true },
        });
      });
    } catch (err) {
      port.postMessage({ type: 'MAPPING_ERROR', payload: { message: String(err) } });
    }
  });

  port.onDisconnect.addListener(() => {
    if (activeSession && activeSession.port === port) {
      chrome.tabs.remove(activeSession.scrapingTabId).catch(() => {});
      activeSession = null;
    }
  });
});

function waitForTabLoad(tabId: number, callback: () => void): void {
  const listener = (
    updatedTabId: number,
    info: chrome.tabs.TabChangeInfo,
  ): void => {
    if (updatedTabId === tabId && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      // Small delay so page scripts settle
      setTimeout(callback, 500);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

// ── Messages from content scripts ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const senderTabId = sender.tab?.id;

  // Relay FIELD_ASSIGNED and MAPPING_COMPLETE/CANCELLED from the active scraping tab
  if (
    activeSession &&
    senderTabId === activeSession.scrapingTabId
  ) {
    if (message.type === 'FIELD_ASSIGNED') {
      const mapping = message.payload as FieldMapping & { field: string };
      activeSession.mappings[mapping.canonicalField] = mapping;
      activeSession.port.postMessage({ type: 'FIELD_ASSIGNED', payload: message.payload });
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'MAPPING_COMPLETE') {
      activeSession.port.postMessage({ type: 'MAPPING_COMPLETE', payload: message.payload });
      chrome.tabs.remove(activeSession.scrapingTabId).catch(() => {});
      activeSession = null;
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'MAPPING_CANCELLED') {
      activeSession.port.postMessage({ type: 'MAPPING_CANCELLED' });
      chrome.tabs.remove(activeSession.scrapingTabId).catch(() => {});
      activeSession = null;
      sendResponse({ ok: true });
      return true;
    }
  }

  // Standard storage messages (popup / non-session flow)
  handleStorageMessage(message).then(sendResponse).catch((err: Error) => {
    sendResponse({ error: err.message });
  });
  return true;
});

// ── Storage helpers ───────────────────────────────────────────────────────────

async function handleStorageMessage(message: Message): Promise<unknown> {
  const { type, payload } = message;

  switch (type) {
    case 'GET_RULE': {
      const domain = payload as string;
      const data = await getStorage();
      return data.rules[domain] ?? null;
    }

    case 'SAVE_RULE': {
      const rule = payload as DomainRule;
      const data = await getStorage();
      data.rules[rule.domain] = rule;
      await setStorage(data);
      return { success: true };
    }

    case 'GET_RULES': {
      const data = await getStorage();
      return data.rules;
    }

    case 'SAVE_PRODUCTS': {
      const { domain, products } = payload as { domain: string; products: ExtractedProduct[] };
      const data = await getStorage();
      const existing = data.products[domain] ?? [];
      data.products[domain] = [...existing, ...products];
      await setStorage(data);
      return { success: true };
    }

    case 'GET_PRODUCTS': {
      const domain = payload as string;
      const data = await getStorage();
      return data.products[domain] ?? [];
    }

    case 'DELETE_RULE': {
      const domain = payload as string;
      const data = await getStorage();
      delete data.rules[domain];
      delete data.products[domain];
      await setStorage(data);
      return { success: true };
    }

    case 'CLEAR_PRODUCTS': {
      const domain = payload as string;
      const data = await getStorage();
      data.products[domain] = [];
      await setStorage(data);
      return { success: true };
    }

    default:
      return null;
  }
}

async function getStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(['rules', 'products']);
  return {
    rules: (result['rules'] as StorageData['rules']) ?? {},
    products: (result['products'] as StorageData['products']) ?? {},
  };
}

async function setStorage(data: StorageData): Promise<void> {
  await chrome.storage.local.set({ rules: data.rules, products: data.products });
}
