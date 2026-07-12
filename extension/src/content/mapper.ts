import type { DomainRule, ExtractedProduct, FieldMapping, FieldDefinition } from '../types';

// ── Handshake: announce extension ID to the Angular frontend ──────────────────

function announceReady(): void {
  window.postMessage({ type: '__VS_READY__', extensionId: chrome.runtime.id }, '*');
}

// Announce immediately (covers: Angular already listening when content script loads)
announceReady();

// Also respond to pings (covers: content script loaded before Angular init)
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if ((e.data as Record<string, unknown>)?.type === '__VS_PING__') {
    announceReady();
  }
});

// ─────────────────────────────────────────────────────────────────────────────

let mappingActive = false;
let fromFrontend = false;
let highlightEl: HTMLDivElement | null = null;
let menuEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;
let currentTarget: Element | null = null;

/** Dynamic field definitions received from the popup. */
let fieldDefs: FieldDefinition[] = [];

/** Accumulated field assignments (used in popup + frontend-triggered modes). */
const assignedFields: Record<string, FieldMapping> = {};
let containerSelector: string | null = null;

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message as { type: string; payload: unknown };

  switch (type) {
    case 'START_MAPPING': {
      const opts = (payload ?? {}) as {
        fromFrontend?: boolean;
        fields?: FieldDefinition[];
      };
      fromFrontend = opts.fromFrontend ?? false;
      // Use provided field definitions, or keep current ones
      if (opts.fields && opts.fields.length > 0) {
        fieldDefs = opts.fields;
      }
      startMapping();
      sendResponse({ success: true });
      break;
    }

    case 'STOP_MAPPING':
      stopMapping();
      sendResponse({ success: true });
      break;

    case 'EXTRACT': {
      const rule = payload as DomainRule;
      const products = extractProducts(rule);
      sendResponse({ products });
      break;
    }

    case 'GET_PAGE_INFO':
      sendResponse({ title: document.title, domain: location.hostname });
      break;

    default:
      sendResponse(null);
  }

  return true;
});

// ── Mapping mode ──────────────────────────────────────────────────────────────

function startMapping(): void {
  mappingActive = true;
  ensureHighlight();
  if (fromFrontend) showPanel();
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
}

function stopMapping(): void {
  mappingActive = false;
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('click', onClick, true);
  removeHighlight();
  removeMenu();
  removePanel();
}

function ensureHighlight(): void {
  if (highlightEl) return;
  highlightEl = document.createElement('div');
  highlightEl.id = '__vs_highlight__';
  Object.assign(highlightEl.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '999999',
    background: 'rgba(14, 90, 255, 0.25)',
    border: '2px solid rgba(14, 90, 255, 0.7)',
    borderRadius: '2px',
    transition: 'all 0.05s ease',
    display: 'none',
  });
  document.documentElement.appendChild(highlightEl);
}

function removeHighlight(): void {
  highlightEl?.remove();
  highlightEl = null;
}

function onMouseOver(e: MouseEvent): void {
  if (!mappingActive || !highlightEl) return;
  const target = e.target as Element;
  if (target === highlightEl || target === menuEl || menuEl?.contains(target)) return;
  if (target === panelEl || panelEl?.contains(target)) return;

  const rect = target.getBoundingClientRect();
  Object.assign(highlightEl.style, {
    display: 'block',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  currentTarget = target;
}

function onClick(e: MouseEvent): void {
  if (!mappingActive) return;
  const target = e.target as Element;
  if (menuEl?.contains(target)) return;
  if (panelEl?.contains(target)) return;

  e.preventDefault();
  e.stopPropagation();

  currentTarget = target;
  showMenu(e.clientX, e.clientY, target);
}

// ── Floating field-assignment menu ────────────────────────────────────────────

function showMenu(x: number, y: number, target: Element): void {
  removeMenu();

  menuEl = document.createElement('div');
  menuEl.id = '__vs_menu__';

  Object.assign(menuEl.style, {
    position: 'fixed',
    zIndex: '1000000',
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '6px',
    padding: '10px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    color: '#eaeaea',
    minWidth: '200px',
  });

  const label = document.createElement('div');
  label.textContent = 'Assign field:';
  Object.assign(label.style, {
    marginBottom: '8px',
    color: '#888',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  });
  menuEl.appendChild(label);

  // Dynamic field buttons from fieldDefs
  if (fieldDefs.length > 0) {
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' });

    for (const def of fieldDefs) {
      const btn = createMenuButton(def.name, '#0f3460', () =>
        assignField(def.name, target, def.type, def.attribute),
      );
      if (assignedFields[def.name]) {
        btn.textContent = `✓ ${def.name}`;
        btn.style.border = '1px solid #4caf50';
      }
      grid.appendChild(btn);
    }
    menuEl.appendChild(grid);
  } else {
    // Fallback: allow typing a custom field name on the fly
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, { display: 'flex', gap: '4px', marginBottom: '8px' });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Field name…';
    Object.assign(nameInput.style, {
      flex: '1',
      background: '#0d0d1a',
      border: '1px solid #333',
      borderRadius: '4px',
      padding: '5px 8px',
      color: '#eaeaea',
      fontSize: '12px',
      outline: 'none',
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Assign';
    Object.assign(addBtn.style, {
      background: '#0f3460',
      color: '#eaeaea',
      border: 'none',
      borderRadius: '4px',
      padding: '5px 10px',
      cursor: 'pointer',
      fontSize: '12px',
    });
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = nameInput.value.trim();
      if (name) {
        assignField(name, target, 'text');
        removeMenu();
      }
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        const name = nameInput.value.trim();
        if (name) {
          assignField(name, target, 'text');
          removeMenu();
        }
      }
    });

    inputRow.appendChild(nameInput);
    inputRow.appendChild(addBtn);
    menuEl.appendChild(inputRow);
  }

  // Container button (always available)
  const containerBtn = createMenuButton('Set as Container', '#e94560', () => assignContainer(target));
  Object.assign(containerBtn.style, { width: '100%', marginBottom: '6px' });
  menuEl.appendChild(containerBtn);

  const cancelBtn = createMenuButton('Cancel', '#333', removeMenu);
  Object.assign(cancelBtn.style, { width: '100%' });
  menuEl.appendChild(cancelBtn);

  document.documentElement.appendChild(menuEl);
  const menuRect = menuEl.getBoundingClientRect();
  const safeX = Math.min(x, window.innerWidth - menuRect.width - 8);
  const safeY = Math.min(y, window.innerHeight - menuRect.height - 8);
  menuEl.style.left = `${Math.max(8, safeX)}px`;
  menuEl.style.top = `${Math.max(8, safeY)}px`;
}

function createMenuButton(text: string, bg: string, handler: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  Object.assign(btn.style, {
    background: bg,
    color: '#eaeaea',
    border: 'none',
    borderRadius: '4px',
    padding: '5px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    handler();
  });
  btn.addEventListener('mouseover', () => { btn.style.opacity = '0.8'; });
  btn.addEventListener('mouseout', () => { btn.style.opacity = '1'; });
  return btn;
}

function removeMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

function assignField(
  field: string,
  el: Element,
  type: FieldMapping['type'],
  attribute?: string,
): void {
  const selector = generateSelector(el);
  const effectiveType = type === 'attribute' && !attribute ? 'text' : type;

  const mapping: FieldMapping = {
    canonicalField: field,
    selector,
    type: effectiveType,
    ...(effectiveType === 'attribute' && attribute ? { attribute } : {}),
  };

  assignedFields[field] = mapping;

  chrome.runtime.sendMessage({
    type: 'FIELD_ASSIGNED',
    payload: mapping,
  });

  if (fromFrontend) updatePanel();
  removeMenu();
}

function assignContainer(el: Element): void {
  const selector = generateSelector(el);
  containerSelector = selector;

  chrome.runtime.sendMessage({
    type: 'FIELD_ASSIGNED',
    payload: {
      canonicalField: 'container',
      selector,
      type: 'text',
    } satisfies FieldMapping,
  });

  if (fromFrontend) updatePanel();
  removeMenu();
}

// ── "Done Mapping" panel (frontend-triggered mode only) ───────────────────────

function showPanel(): void {
  if (panelEl) return;

  panelEl = document.createElement('div');
  panelEl.id = '__vs_panel__';
  Object.assign(panelEl.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '1000001',
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '14px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    color: '#eaeaea',
    minWidth: '220px',
    userSelect: 'none',
  });

  document.documentElement.appendChild(panelEl);
  renderPanel();
}

function renderPanel(): void {
  if (!panelEl) return;
  panelEl.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Visual Scraper';
  Object.assign(title.style, {
    fontWeight: '600',
    marginBottom: '10px',
    fontSize: '14px',
    color: '#4a9eff',
  });
  panelEl.appendChild(title);

  // Dynamic fields from fieldDefs
  for (const def of fieldDefs) {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' });

    const dot = document.createElement('span');
    const assigned = assignedFields[def.name];
    dot.textContent = assigned ? '✓' : '○';
    dot.style.color = assigned ? '#4caf50' : '#555';
    dot.style.width = '14px';

    const name = document.createElement('span');
    name.textContent = def.name;
    name.style.color = assigned ? '#eaeaea' : '#666';

    row.appendChild(dot);
    row.appendChild(name);
    panelEl!.appendChild(row);
  }

  // Container
  const containerRow = document.createElement('div');
  Object.assign(containerRow.style, { display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0' });
  const cDot = document.createElement('span');
  cDot.textContent = containerSelector ? '✓' : '○';
  cDot.style.color = containerSelector ? '#4caf50' : '#555';
  cDot.style.width = '14px';
  const cName = document.createElement('span');
  cName.textContent = 'container';
  cName.style.color = containerSelector ? '#eaeaea' : '#666';
  containerRow.appendChild(cDot);
  containerRow.appendChild(cName);
  panelEl.appendChild(containerRow);

  const separator = document.createElement('hr');
  Object.assign(separator.style, { border: 'none', borderTop: '1px solid #0f3460', margin: '10px 0' });
  panelEl.appendChild(separator);

  // Can finish if container + at least one field assigned
  const hasFields = Object.keys(assignedFields).length > 0;
  const canFinish = hasFields && !!containerSelector;

  const finishBtn = document.createElement('button');
  finishBtn.textContent = 'Finish Mapping';
  Object.assign(finishBtn.style, {
    width: '100%',
    background: canFinish ? '#0f3460' : '#2a2a3e',
    color: canFinish ? '#eaeaea' : '#555',
    border: 'none',
    borderRadius: '4px',
    padding: '8px',
    cursor: canFinish ? 'pointer' : 'default',
    fontSize: '13px',
    marginBottom: '6px',
  });
  if (canFinish) {
    finishBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      finishMapping();
    });
  }
  panelEl.appendChild(finishBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    width: '100%',
    background: 'transparent',
    color: '#888',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '6px',
    cursor: 'pointer',
    fontSize: '12px',
  });
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelMapping();
  });
  panelEl.appendChild(cancelBtn);
}

function updatePanel(): void {
  if (!panelEl) return;
  renderPanel();
}

function removePanel(): void {
  panelEl?.remove();
  panelEl = null;
}

function finishMapping(): void {
  // Extraer productos usando los selectores elegidos
  const products = extractProducts({
    domain: location.hostname,
    containerSelector: containerSelector ?? '',
    fieldMappings: Object.values(assignedFields),
    createdAt: 0,
    updatedAt: 0,
  } as DomainRule);

  const payload = {
    fieldMappings: Object.values(assignedFields),
    containerSelector,
    domain: location.hostname,
    pageTitle: document.title,
    products,
  };
  chrome.runtime.sendMessage({ type: 'MAPPING_COMPLETE', payload });
  stopMapping();
}

function cancelMapping(): void {
  chrome.runtime.sendMessage({ type: 'MAPPING_CANCELLED' });
  stopMapping();
}

// ── CSS selector generator ────────────────────────────────────────────────────

function generateSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const path: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  const MAX_DEPTH = 4;

  while (current && current !== document.body && current !== document.documentElement && depth < MAX_DEPTH) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;

    const meaningfulClasses = Array.from(current.classList).filter(
      (c) => typeof c === 'string' && c.length > 1 && !c.startsWith('_'),
    );

    let segment = tag;
    if (meaningfulClasses.length > 0) {
      const topClasses = meaningfulClasses.slice(0, 2);
      segment += topClasses.map((c) => `.${CSS.escape(c)}`).join('');
    } else if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName,
      );
      const index = sameTagSiblings.indexOf(current) + 1;
      if (sameTagSiblings.length > 1) {
        segment += `:nth-child(${index})`;
      }
    }

    if (parent?.id) {
      path.unshift(segment);
      return `#${CSS.escape(parent.id)} > ${path.join(' > ')}`;
    }

    path.unshift(segment);
    current = parent;
    depth++;
  }

  return path.join(' > ');
}

// ── Extraction helpers ────────────────────────────────────────────────────────

/**
 * Extract the leading price string from an arbitrary text and parse it into
 * a number, respecting the locale conventions most common in scraped
 * e-commerce data:
 *
 *   • Both '.' and ',' present  → the rightmost separator is the decimal
 *     mark; the other is the thousands separator. Drop everything else.
 *     "$1,299.00" → 1299.00; "1.299,00" → 1299.00
 *   • Only ',' present            → comma is the decimal separator
 *     (European). "19,99" → 19.99
 *   • Only '.' present            → period is the decimal separator
 *     (US/UK). "19.99" → 19.99
 *   • No digits → null (caller skips coercion).
 *
 * Exported for unit testing. Returns null when no number can be recovered
 * so callers can leave the raw string alone.
 */
export function parseLocalizedPrice(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  // Work only with the substring between leading and trailing non-numeric
  // noise (currency symbols, "Price:" prefix, "USD" suffix, etc.).
  const match = raw.match(/[-+]?\d[\d.,\s]*/);
  if (!match) return null;
  const trimmed = match[0].replace(/\s/g, '');
  if (trimmed === '') return null;

  const lastDot = trimmed.lastIndexOf('.');
  const lastComma = trimmed.lastIndexOf(',');
  const hasDot = lastDot !== -1;
  const hasComma = lastComma !== -1;

  let normalised: string;
  if (hasDot && hasComma) {
    // Rightmost separator wins as the decimal mark.
    if (lastComma > lastDot) {
      // European: dots are thousands, comma is decimal.
      normalised = trimmed.replace(/\./g, '').replace(',', '.');
    } else {
      // US: commas are thousands, dot is decimal.
      normalised = trimmed.replace(/,/g, '');
    }
  } else if (hasComma) {
    // European with no thousands separator.
    normalised = trimmed.replace(',', '.');
  } else {
    // US-style or plain: keep digits and the dot.
    normalised = trimmed;
  }

  const parsed = parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

const IMAGE_FIELD_RE = /^image$|^img$|^foto$|^photo$|^picture$|^thumbnail$|^icon$|^imagen$/i;

/** Search up to 3 levels above `el` for an <img> and return its src. */
function findNearbyImageSrc(el: Element): string | null {
  // First try inside the element itself
  const ownImg = el.querySelector('img');
  if (ownImg) return ownImg.getAttribute('src');

  // Then walk up to 3 levels, checking each ancestor for an <img>
  let current: Element | null = el;
  for (let depth = 0; depth < 3 && current; depth++) {
    const parent = current.parentElement;
    if (!parent) break;
    // Look for an img among the siblings of the current node
    const siblingImg = Array.from(parent.children).find(
      (sibling) => sibling !== current && sibling.tagName === 'IMG',
    ) as HTMLImageElement | undefined;
    if (siblingImg?.getAttribute('src')) {
      return siblingImg.getAttribute('src');
    }
    // Also check the parent itself
    const parentImg = parent.querySelector('img');
    if (parentImg && parentImg !== ownImg) {
      return parentImg.getAttribute('src');
    }
    current = parent;
  }

  return null;
}

function extractFieldsFromElement(
  root: Element,
  mappings: FieldMapping[],
): ExtractedProduct | null {
  const product: ExtractedProduct = {};
  for (const mapping of mappings) {
    const el = root.querySelector(mapping.selector);
    if (!el) continue;

    if (mapping.type === 'text') {
      product[mapping.canonicalField] = el.textContent?.trim() ?? null;
    } else if (mapping.type === 'attribute') {
      product[mapping.canonicalField] = el.getAttribute(mapping.attribute ?? '') ?? null;
    } else if (mapping.type === 'html') {
      product[mapping.canonicalField] = el.innerHTML?.trim() ?? null;
    }

    // Heuristic: if the field looks like an image but we got text content
    // (not a URL), try to find an <img> near the matched element and grab
    // its src attribute. Searches up to 3 levels up (the image is often a
    // sibling rather than a child of the clicked element).
    if (mapping.type === 'text' && IMAGE_FIELD_RE.test(mapping.canonicalField)) {
      const raw = product[mapping.canonicalField];
      if (typeof raw === 'string' && raw && !raw.startsWith('http')) {
        const src = findNearbyImageSrc(el);
        if (src) product[mapping.canonicalField] = src;
      }
    }

    coercePriceField(product, mapping);
  }
  const hasValue = Object.values(product).some((v) => v !== null && v !== undefined);
  return hasValue ? product : null;
}

function coercePriceField(
  product: ExtractedProduct,
  mapping: FieldMapping,
): void {
  if (
    typeof product[mapping.canonicalField] === 'string' &&
    /precio|price|amount|cost|costo/i.test(mapping.canonicalField)
  ) {
    const parsed = parseLocalizedPrice(
      product[mapping.canonicalField] as string,
    );
    if (parsed !== null) {
      product[mapping.canonicalField] = parsed;
    }
  }
}

/**
 * Extract fields from each matched group by index (global fallback).
 * Queries each field selector from document and groups results by their
 * DOM position — element[n] of every field becomes product[n].
 */
function extractProductsGlobal(mappings: FieldMapping[]): ExtractedProduct[] {
  // Query every field globally
  const fieldResults: Record<string, Element[]> = {};
  let maxCount = 0;
  for (const m of mappings) {
    const nodes = Array.from(document.querySelectorAll(m.selector));
    fieldResults[m.canonicalField] = nodes;
    if (nodes.length > maxCount) maxCount = nodes.length;
  }

  if (maxCount === 0) return [];

  // Use the median count to avoid a single field with extra matches
  const counts = mappings.map((m) => fieldResults[m.canonicalField].length).sort((a, b) => a - b);
  const target = counts[Math.floor(counts.length / 2)];

  const products: ExtractedProduct[] = [];
  for (let i = 0; i < target; i++) {
    const product: ExtractedProduct = {};
    for (const m of mappings) {
      const el = fieldResults[m.canonicalField][i];
      if (!el) continue;

      if (m.type === 'text') {
        product[m.canonicalField] = el.textContent?.trim() ?? null;
      } else if (m.type === 'attribute') {
        product[m.canonicalField] = el.getAttribute(m.attribute ?? '') ?? null;
      } else if (m.type === 'html') {
        product[m.canonicalField] = el.innerHTML?.trim() ?? null;
      }

      // Same image heuristic: if text content isn't a URL, try to find
      // a nearby <img> (up to 3 levels up).
      if (m.type === 'text' && IMAGE_FIELD_RE.test(m.canonicalField)) {
        const raw = product[m.canonicalField];
        if (typeof raw === 'string' && raw && !raw.startsWith('http')) {
          const src = findNearbyImageSrc(el);
          if (src) product[m.canonicalField] = src;
        }
      }

      coercePriceField(product, m);
    }
    // Only include products that have a title-like field with a value.
    // This filters out index slots where the title selector didn't match
    // (common when title has fewer DOM matches than price/image).
    const hasTitle = mappings.some(
      (m) =>
        /^title$|^nombre$|^name$|^titulo$/i.test(m.canonicalField) &&
        product[m.canonicalField] != null &&
        product[m.canonicalField] !== '',
    );
    if (hasTitle) products.push(product);
  }
  return products;
}

function extractProducts(rule: DomainRule): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];

  // ── 1. Container-child iteration ────────────────────────────────
  // Try extracting fields relative to each child of the container.
  // Works well when selectors are relative paths within each card.
  const containers = document.querySelectorAll(rule.containerSelector);
  containers.forEach((container) => {
    const items = Array.from(container.children).filter(
      (child) => child.children.length > 0,
    );

    if (items.length > 0) {
      for (const item of items) {
        const p = extractFieldsFromElement(item, rule.fieldMappings);
        if (p) products.push(p);
      }
    } else {
      // Direct product pattern — the container IS the product
      const p = extractFieldsFromElement(container, rule.fieldMappings);
      if (p) products.push(p);
    }
  });

  // ── 2. Global index grouping ────────────────────────────────────
  // The extension generates absolute CSS selectors (from document root).
  // When queried relative to a child element they rarely match, so we
  // fall back to querying each selector globally and grouping results
  // by DOM position: element[N] of every field → product[N].
  //
  // Run this ALWAYS (not only when step 1 yields 0) because global
  // queries handle the real multi-product extraction while step 1 may
  // accidentally grab a single product via the container itself.
  const globals = extractProductsGlobal(rule.fieldMappings);

  // Merge: prefer global results (they capture all products), but keep
  // container results as a fallback when global returns nothing.
  if (globals.length > 0) return globals;
  return products;
}

void currentTarget;
