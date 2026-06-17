import type { DomainRule, ExtractedProduct, FieldMapping, CanonicalField } from '../types';

let mappingActive = false;
let highlightEl: HTMLDivElement | null = null;
let menuEl: HTMLDivElement | null = null;
let currentTarget: Element | null = null;

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message as { type: string; payload: unknown };

  switch (type) {
    case 'START_MAPPING':
      startMapping();
      sendResponse({ success: true });
      break;

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
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
}

function stopMapping(): void {
  mappingActive = false;
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('click', onClick, true);
  removeHighlight();
  removeMenu();
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
  // Don't intercept clicks on our own menu
  if (menuEl?.contains(target)) return;

  e.preventDefault();
  e.stopPropagation();

  currentTarget = target;
  showMenu(e.clientX, e.clientY, target);
}

// ── Floating field-assignment menu ────────────────────────────────────────────

const FIELD_LABELS: Array<{ label: string; field: CanonicalField }> = [
  { label: 'Title', field: 'title' },
  { label: 'Price', field: 'price' },
  { label: 'Image', field: 'imageUrl' },
  { label: 'SKU', field: 'sku' },
  { label: 'Currency', field: 'currency' },
  { label: 'Description', field: 'description' },
];

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

  const grid = document.createElement('div');
  Object.assign(grid.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' });

  FIELD_LABELS.forEach(({ label: btnLabel, field }) => {
    const btn = createMenuButton(btnLabel, '#0f3460', () => assignField(field, target));
    grid.appendChild(btn);
  });
  menuEl.appendChild(grid);

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

function assignField(field: CanonicalField, el: Element): void {
  const selector = generateSelector(el);
  const type: FieldMapping['type'] = field === 'imageUrl' ? 'attribute' : 'text';
  const attribute = field === 'imageUrl' ? 'src' : undefined;

  chrome.runtime.sendMessage({
    type: 'FIELD_ASSIGNED',
    payload: { field, selector, type, attribute },
  });

  removeMenu();
}

function assignContainer(el: Element): void {
  const selector = generateSelector(el);
  chrome.runtime.sendMessage({
    type: 'FIELD_ASSIGNED',
    payload: { field: 'container', selector, type: 'text' },
  });
  removeMenu();
}

// ── CSS selector generator ────────────────────────────────────────────────────

function generateSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      const index = siblings.indexOf(current) + 1;
      path.unshift(siblings.length > 1 ? `${tag}:nth-child(${index})` : tag);
    } else {
      path.unshift(tag);
    }
    current = parent;
  }
  return path.join(' > ');
}

// ── Extraction ────────────────────────────────────────────────────────────────

function extractProducts(rule: DomainRule): ExtractedProduct[] {
  const containers = document.querySelectorAll(rule.containerSelector);
  const products: ExtractedProduct[] = [];

  containers.forEach(container => {
    const product: ExtractedProduct = {};
    for (const mapping of rule.fieldMappings) {
      const el = container.querySelector(mapping.selector);
      if (!el) continue;

      if (mapping.type === 'text') {
        product[mapping.canonicalField] = el.textContent?.trim() ?? null;
      } else if (mapping.type === 'attribute') {
        product[mapping.canonicalField] = el.getAttribute(mapping.attribute ?? '') ?? null;
      } else if (mapping.type === 'html') {
        product[mapping.canonicalField] = el.innerHTML?.trim() ?? null;
      }

      if (mapping.canonicalField === 'price') {
        const raw = product[mapping.canonicalField] as string;
        const parsed = parseFloat(raw?.replace(/[^0-9.]/g, '') ?? '');
        product[mapping.canonicalField] = isNaN(parsed) ? null : parsed;
      }
    }
    if (product['title'] || product['price']) products.push(product);
  });

  return products;
}

// Suppress unused variable warning — currentTarget is set for potential future use
void currentTarget;
