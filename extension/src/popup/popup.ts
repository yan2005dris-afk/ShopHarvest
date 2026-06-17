import type { DomainRule, ExtractedProduct, FieldMapping, CanonicalField } from '../types';

// ── State ─────────────────────────────────────────────────────────────────────

let currentDomain = '';
let currentTabId = 0;
let currentTabUrl: string | undefined;
let currentRule: DomainRule | null = null;
let pendingMappings: Map<string, { selector: string; type: FieldMapping['type']; attribute?: string }> = new Map();
let extractedProducts: ExtractedProduct[] = [];

// ── DOM references ────────────────────────────────────────────────────────────

const views = {
  home: document.getElementById('view-home')!,
  mapping: document.getElementById('view-mapping')!,
  data: document.getElementById('view-data')!,
};

const el = {
  domainBadge: document.getElementById('domain-badge')!,
  ruleStatus: document.getElementById('rule-status')!,
  btnStartMapping: document.getElementById('btn-start-mapping') as HTMLButtonElement,
  btnExtract: document.getElementById('btn-extract') as HTMLButtonElement,
  btnViewData: document.getElementById('btn-view-data') as HTMLButtonElement,
  homeError: document.getElementById('home-error')!,
  btnSaveRule: document.getElementById('btn-save-rule') as HTMLButtonElement,
  btnCancelMapping: document.getElementById('btn-cancel-mapping') as HTMLButtonElement,
  btnExportCsv: document.getElementById('btn-export-csv') as HTMLButtonElement,
  btnClearData: document.getElementById('btn-clear-data') as HTMLButtonElement,
  btnBack: document.getElementById('btn-back') as HTMLButtonElement,
  productCount: document.getElementById('product-count')!,
  tableHead: document.getElementById('table-head')!,
  tableBody: document.getElementById('table-body')!,
  toast: document.getElementById('toast')!,
};

// ── Initialization ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    showError('Cannot access this page.');
    return;
  }

  currentTabId = tab.id;
  currentTabUrl = tab.url;
  const url = new URL(tab.url);
  currentDomain = url.hostname;
  el.domainBadge.textContent = currentDomain;

  currentRule = await bgMessage('GET_RULE', currentDomain);
  if (currentRule) {
    el.ruleStatus.classList.remove('hidden');
  }

  showView('home');
  bindEvents();
}

// ── View management ───────────────────────────────────────────────────────────

function showView(name: keyof typeof views): void {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents(): void {
  el.btnStartMapping.addEventListener('click', onStartMapping);
  el.btnExtract.addEventListener('click', onExtract);
  el.btnViewData.addEventListener('click', onViewData);
  el.btnSaveRule.addEventListener('click', onSaveRule);
  el.btnCancelMapping.addEventListener('click', onCancelMapping);
  el.btnExportCsv.addEventListener('click', onExportCsv);
  el.btnClearData.addEventListener('click', onClearData);
  el.btnBack.addEventListener('click', () => showView('home'));

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'FIELD_ASSIGNED') {
      const { field, selector, type, attribute } = message.payload as {
        field: string;
        selector: string;
        type: FieldMapping['type'];
        attribute?: string;
      };
      onFieldAssigned(field, selector, type, attribute);
    }
  });
}

async function onStartMapping(): Promise<void> {
  pendingMappings = new Map();
  resetMappingView();

  try {
    await contentMessage('START_MAPPING', undefined);
    showView('mapping');
  } catch {
    showError('Cannot inject into this page. Try a regular website.');
  }
}

async function onExtract(): Promise<void> {
  if (!currentRule) {
    showError('No rule saved for this domain. Map fields first.');
    return;
  }
  el.homeError.classList.add('hidden');

  try {
    const result = await contentMessage<{ products: ExtractedProduct[] }>('EXTRACT', currentRule);
    extractedProducts = result.products ?? [];

    await fetch('http://localhost:3000/products/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: currentDomain, pageUrl: currentTabUrl, products: extractedProducts }),
    }).catch(() => {});
    renderDataView(extractedProducts);
    showView('data');
  } catch (err) {
    showError(`Extraction failed: ${(err as Error).message}`);
  }
}

async function onViewData(): Promise<void> {
  const products = await bgMessage<ExtractedProduct[]>('GET_PRODUCTS', currentDomain);
  extractedProducts = products ?? [];
  renderDataView(extractedProducts);
  showView('data');
}

function onFieldAssigned(field: string, selector: string, type: FieldMapping['type'], attribute?: string): void {
  pendingMappings.set(field, { selector, type, attribute });

  if (field === 'container') {
    updateFieldRow('container', selector);
  } else {
    updateFieldRow(field as CanonicalField, selector);
  }

  checkSaveEnabled();
}

async function onSaveRule(): Promise<void> {
  const containerEntry = pendingMappings.get('container');
  if (!containerEntry) return;

  const fieldMappings: FieldMapping[] = [];
  pendingMappings.forEach((value, key) => {
    if (key === 'container') return;
    fieldMappings.push({
      canonicalField: key as CanonicalField,
      selector: value.selector,
      type: value.type,
      attribute: value.attribute,
    });
  });

  const rule: DomainRule = {
    domain: currentDomain,
    containerSelector: containerEntry.selector,
    fieldMappings,
    createdAt: currentRule?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  await bgMessage('SAVE_RULE', rule);
  currentRule = rule;

  await contentMessage('STOP_MAPPING', undefined).catch(() => {});

  el.ruleStatus.classList.remove('hidden');
  showToast('Rule saved!');
  showView('home');
}

async function onCancelMapping(): Promise<void> {
  await contentMessage('STOP_MAPPING', undefined).catch(() => {});
  showView('home');
}

function onExportCsv(): void {
  if (!extractedProducts.length) return;

  const headers = Object.keys(extractedProducts[0]!);
  const rows = extractedProducts.map(p => headers.map(h => JSON.stringify(p[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentDomain}-products.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function onClearData(): Promise<void> {
  await bgMessage('CLEAR_PRODUCTS', currentDomain);
  extractedProducts = [];
  renderDataView([]);
  showToast('Data cleared');
}

// ── Mapping view helpers ──────────────────────────────────────────────────────

function resetMappingView(): void {
  const fieldIds = ['container', 'title', 'price', 'imageUrl', 'sku', 'currency', 'description'];
  fieldIds.forEach(f => {
    const span = document.getElementById(`field-${f}`);
    if (span) {
      span.textContent = 'not set';
      span.classList.remove('set');
    }
  });
  el.btnSaveRule.disabled = true;
}

function updateFieldRow(field: string, selector: string): void {
  const span = document.getElementById(`field-${field}`);
  if (!span) return;
  span.textContent = selector.length > 30 ? `…${selector.slice(-27)}` : selector;
  span.classList.add('set');
}

function checkSaveEnabled(): void {
  const hasTitle = pendingMappings.has('title');
  const hasPrice = pendingMappings.has('price');
  const hasContainer = pendingMappings.has('container');
  el.btnSaveRule.disabled = !(hasTitle && hasPrice && hasContainer);
}

// ── Data view ─────────────────────────────────────────────────────────────────

function renderDataView(products: ExtractedProduct[]): void {
  el.productCount.textContent = `${products.length} product(s) extracted`;
  el.tableHead.innerHTML = '';
  el.tableBody.innerHTML = '';

  if (!products.length) return;

  const headers = Object.keys(products[0]!);
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    el.tableHead.appendChild(th);
  });

  const preview = products.slice(0, 5);
  preview.forEach(product => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = String(product[h] ?? '');
      td.title = String(product[h] ?? '');
      tr.appendChild(td);
    });
    el.tableBody.appendChild(tr);
  });
}

// ── Messaging helpers ─────────────────────────────────────────────────────────

function bgMessage<T = unknown>(type: string, payload: unknown): Promise<T> {
  return chrome.runtime.sendMessage({ type, payload }) as Promise<T>;
}

function contentMessage<T = unknown>(type: string, payload: unknown): Promise<T> {
  return chrome.tabs.sendMessage(currentTabId, { type, payload }) as Promise<T>;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showError(msg: string): void {
  el.homeError.textContent = msg;
  el.homeError.classList.remove('hidden');
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string, isError = false): void {
  el.toast.textContent = msg;
  el.toast.className = `toast${isError ? ' error-toast' : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.add('hidden');
  }, 2500);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

init().catch(console.error);
