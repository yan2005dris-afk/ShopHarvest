import type { DomainRule, ExtractedProduct, Message, StorageData } from '../types';

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err: Error) => {
    sendResponse({ error: err.message });
  });
  return true; // keep channel open for async response
});

async function handleMessage(message: Message): Promise<unknown> {
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
