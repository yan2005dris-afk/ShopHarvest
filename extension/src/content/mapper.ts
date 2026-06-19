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

function extractFieldsFrom(
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

    // Price parsing (only if field looks like a price)
    if (typeof product[mapping.canonicalField] === 'string') {
      const raw = product[mapping.canonicalField] as string;
      const parsed = parseFloat(raw.replace(/[^0-9.]/g, '') ?? '');
      if (!isNaN(parsed)) {
        product[mapping.canonicalField] = parsed;
      }
    }
  }
  const hasValue = Object.values(product).some((v) => v !== null && v !== undefined);
  return hasValue ? product : null;
}

function extractProducts(rule: DomainRule): ExtractedProduct[] {
  const containers = document.querySelectorAll(rule.containerSelector);
  const products: ExtractedProduct[] = [];

  containers.forEach(container => {
    // If the container has children that themselves have children, treat each
    // child as a product item (list-wrapper pattern, e.g. a grid of cards).
    const items = Array.from(container.children).filter(
      (child) => child.children.length > 0,
    );

    if (items.length > 0) {
      for (const item of items) {
        const p = extractFieldsFrom(item, rule.fieldMappings);
        if (p) products.push(p);
      }
    } else {
      // Direct product pattern — the container IS the product
      const p = extractFieldsFrom(container, rule.fieldMappings);
      if (p) products.push(p);
    }
  });

  return products;
}

void currentTarget;
