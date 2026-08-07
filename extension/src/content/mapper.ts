import type { DomainRule, ExtractedProduct, FieldMapping } from '../types';

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

/**
 * The ONLY thing the user picks by clicking on the page: the product
 * container. Everything else (title, price, image, url, ...) is
 * auto-extracted from inside that container and mapped in the frontend
 * preview — see `extractAllFromContainer`. There is no per-field click
 * assignment; that manual path was removed so "select container, review
 * in preview" is the single mapping methodology.
 */
let containerSelector: string | null = null;

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message as { type: string; payload: unknown };

  switch (type) {
    case 'START_MAPPING': {
      const opts = (payload ?? {}) as { fromFrontend?: boolean };
      fromFrontend = opts.fromFrontend ?? false;
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
  label.textContent = 'Click the card that wraps one product';
  Object.assign(label.style, {
    marginBottom: '8px',
    color: '#888',
    fontSize: '11px',
    maxWidth: '200px',
  });
  menuEl.appendChild(label);

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

  // Container — the one thing the user picks by clicking.
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

  const canFinish = !!containerSelector;

  const finishBtn = document.createElement('button');
  finishBtn.textContent = 'Finish — Extract All';
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

  const hint = document.createElement('p');
  hint.textContent = '💡 All fields will be auto-detected — pick in preview';
  Object.assign(hint.style, {
    margin: '0 0 6px',
    fontSize: '10px',
    color: '#4a9eff',
    textAlign: 'center',
  });
  panelEl.appendChild(hint);

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
  // Container-only methodology: always extract everything from inside
  // the container (extractAllFromContainer, via extractProducts with an
  // empty fieldMappings list) — the frontend preview is where canonical
  // fields (título, precio, imagen, url...) get picked.
  const products = extractProducts({
    domain: location.hostname,
    containerSelector: containerSelector ?? '',
    fieldMappings: [],
    createdAt: 0,
    updatedAt: 0,
  } as DomainRule);

  const payload = {
    fieldMappings: [],
    containerSelector,
    domain: location.hostname,
    pageTitle: document.title,
    products,
    extractAll: true,
  };
  chrome.runtime.sendMessage({ type: 'MAPPING_COMPLETE', payload });
  stopMapping();
}

function cancelMapping(): void {
  chrome.runtime.sendMessage({ type: 'MAPPING_CANCELLED' });
  stopMapping();
}

// ── CSS selector generator ────────────────────────────────────────────────────

/**
 * Generate a CSS selector path from `root` (or document body) to `el`.
 * When `root` is provided, the returned selector is relative to `root` —
 * usable with `root.querySelector(selector)` — so container-child extraction
 * works correctly instead of relying on the fragile global-index fallback.
 */
function generateSelector(el: Element, root?: Element): string {
  if (!root && el.id) return `#${CSS.escape(el.id)}`;

  const path: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  const MAX_DEPTH = root ? 10 : 4;
  const stopAt = root ?? document.body;

  while (current && current !== stopAt && current !== document.documentElement && depth < MAX_DEPTH) {
    const tag = current.tagName.toLowerCase();
    const parentEl: Element | null = current.parentElement;

    const meaningfulClasses = Array.from(current.classList).filter(
      (c): c is string => typeof c === 'string' && c.length > 1 && !c.startsWith('_'),
    );

    let segment = tag;
    if (meaningfulClasses.length > 0) {
      const topClasses = meaningfulClasses.slice(0, 2);
      segment += topClasses.map((c) => `.${CSS.escape(c)}`).join('');
    } else if (parentEl) {
      const sameTagSiblings = Array.from(parentEl.children).filter(
        (c): c is Element => c instanceof Element && c.tagName === current!.tagName,
      );
      const index = sameTagSiblings.indexOf(current) + 1;
      if (sameTagSiblings.length > 1) {
        segment += `:nth-of-type(${index})`;
      }
    }

    // When generating absolute selectors, bail early on a parent with an id
    if (!root && parentEl?.id) {
      path.unshift(segment);
      return `#${CSS.escape(parentEl.id)} > ${path.join(' > ')}`;
    }

    path.unshift(segment);
    current = parentEl;
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

/** Currency symbols/codes commonly seen in scraped e-commerce prices. */
const CURRENCY_RE = /[$€£¥₹]|USD|EUR|GBP|COP|MXN|ARS|PEN|CLP|S\/\.?|Bs\.?|R\$/;

/** Matches class/attribute hints that mark an element as a rating/review widget. */
const RATING_HINT_RE = /rating|stars?|review|puntuaci[oó]n|calificaci[oó]n|estrella/i;

/**
 * Matches class/attribute hints for a number that IS a currency amount
 * but ISN'T the product's price — shipping, a per-unit breakdown,
 * an installment amount, taxes. A card can legitimately show
 * "$20.00" (price) next to "$1.00" (shipping) or "12x $1.67"
 * (installment) — both parse fine and both have a currency symbol,
 * so Math.min() over every currency-tagged number picks whichever is
 * smallest, which is very often NOT the price.
 */
const NON_PRICE_AMOUNT_HINT_RE =
  /shipping|envio|env[ií]o|flete|delivery|entrega|installment|cuota|financ|unit[- ]?price|per[- ]?unit|precio[- ]?unit|por[- ]?unidad|tax|impuesto|fee|discount|descuento|ahorro|off\b/i;

/**
 * True when `el` (or a close ancestor) looks like a star-rating widget
 * rather than a price. Star ratings are almost always a small number
 * (0–5 or 0–10) with no currency symbol, and they parse as valid numbers
 * just like prices — without this check, `Math.min()` over "every number
 * on the card" picks the rating instead of the real price.
 */
function isRatingElement(el: Element): boolean {
  if (RATING_HINT_RE.test(el.className)) return true;
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && RATING_HINT_RE.test(ariaLabel)) return true;
  if (el.getAttribute('itemprop') === 'ratingValue') return true;

  // Check for star rating ancestor or sibling SVG/icon patterns
  const ratingAncestor = el.closest(
    '[class*="rating" i], [class*="stars" i], [class*="review" i], [itemprop="ratingValue"]',
  );
  if (ratingAncestor) return true;

  // Additional heuristic: if element text is 0-10 range and nearby siblings
  // have SVG or star icons, it's likely a rating not a price
  const text = el.textContent?.trim() ?? '';
  const num = parseFloat(text);
  if (!isNaN(num) && num >= 0 && num <= 10 && !CURRENCY_RE.test(text)) {
    // Check if parent contains star icons or rating-class siblings
    const parent = el.parentElement;
    if (parent) {
      const parentClass = parent.className.toLowerCase();
      if (
        parentClass.includes('star') ||
        parentClass.includes('rating') ||
        parentClass.includes('review')
      ) {
        return true;
      }
      // Check for SVG or icon siblings (common in modern star ratings)
      const hasSiblingIcon = Array.from(parent.children).some(
        (sibling) =>
          sibling !== el &&
          (sibling.tagName === 'SVG' ||
            sibling.className.toLowerCase().includes('icon') ||
            sibling.className.toLowerCase().includes('star')),
      );
      if (hasSiblingIcon) return true;
    }
  }

  return false;
}

/** True when `el` (or a close ancestor) looks like shipping/fee/installment, not the price. */
function isNonPriceAmountElement(el: Element): boolean {
  if (NON_PRICE_AMOUNT_HINT_RE.test(el.className)) return true;
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && NON_PRICE_AMOUNT_HINT_RE.test(ariaLabel)) return true;
  return !!el.closest(
    '[class*="shipping" i], [class*="envio" i], [class*="delivery" i], [class*="installment" i], [class*="cuota" i], [class*="discount" i], [class*="descuento" i]',
  );
}

/**
 * Pattern-based price detection: finds currency symbol + digits across
 * multi-span scenarios. Returns all matched prices in ascending order.
 * Handles fragmented prices like Temu's: $ | 267 | ,88 in separate spans.
 *
 * Search strategy: look in nested price containers first (data-type="price",
 * hidden divs with _382YgpSF class), then fall back to entire container.
 * This handles both visible and aria-hidden price elements on Temu.
 */
function detectPriceByPattern(container: Element): number[] {
  // Priority 1: Look inside explicit price containers (usually found and sufficient)
  let priceContainer = container.querySelector('[data-type="price"]');
  if (!priceContainer) {
    // Priority 2: Look for hidden price divs (aria-hidden Temu price spans)
    priceContainer = container.querySelector('[class*="382YgpSF"]');
  }
  if (!priceContainer) {
    // Priority 3: Fall back to entire container
    priceContainer = container;
  }

  // Collect all text nodes (skipping rating/non-price elements)
  const allText = Array.from(priceContainer.querySelectorAll('span, div, p'))
    .filter((el) => !isRatingElement(el) && !isNonPriceAmountElement(el))
    .map((el) => el.textContent?.trim() ?? '')
    .join(' ')
    .replace(/\s/g, ''); // Remove spaces so fragmented prices like "$ 379 ,99" become "$379,99"

  // Match currency symbol followed by numbers (with optional decimals/commas)
  // Handles: $100, 100.50, 100,50, €99, £50, ¥1000, ₹500
  // Now robust for multi-span fragments without whitespace interference
  const pricePattern = /[$€£¥₹](\d+(?:[.,]\d{1,3})*)/g;
  const matches = allText.matchAll(pricePattern);
  const prices: number[] = [];

  for (const match of matches) {
    const priceStr = match[0].replace(/[$€£¥₹]/g, '');
    const parsed = parseLocalizedPrice(priceStr);
    if (parsed !== null && parsed > 0 && parsed < 1000000) {
      // Sanity check: price under 1M (filters obvious false positives)
      prices.push(parsed);
    }
  }

  // Deduplicate and return sorted
  return [...new Set(prices)].sort((a, b) => a - b);
}

/**
 * Attributes lazy-load libraries stash the real image URL in while the
 * browser hasn't scrolled the element into view yet. Checked BEFORE the
 * `src` attribute — most lazy-load setups leave `src` pointing at a
 * placeholder (or unset entirely) until an IntersectionObserver fires.
 */
const LAZY_SRC_ATTRS = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-echo'];
const LAZY_SRCSET_ATTRS = ['data-srcset', 'srcset'];

/** Filename/placeholder patterns for 1x1 trackers and lazy-load stand-ins. */
const PLACEHOLDER_IMAGE_RE = /placeholder|blank\.gif|spacer\.gif|lazy(?:load)?\.(?:svg|gif|png)|1x1|transparent\.(?:gif|png)|loading\.(?:svg|gif)/i;

/** Take the first URL out of a `srcset` value ("url1 480w, url2 800w"). */
function firstUrlFromSrcset(value: string): string | null {
  const first = value.split(',')[0]?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/**
 * Resolve the real image URL off `<img>` or `<picture><source>`.
 *
 * IMPORTANT: reads the `src` ATTRIBUTE, never the `.src` DOM property —
 * for an <img> with no `src` attribute set (common while a lazy-load
 * library waits for it to scroll into view), `.src` silently resolves
 * to `location.href` (the page's own URL, per the HTML spec's "resolve
 * against the base URI" rule for a missing/empty attribute) instead of
 * returning empty. That quirk, combined with never checking the
 * standard `data-src`/`srcset` lazy-load attributes, is why only the
 * handful of images already visible in the initial viewport used to
 * get scraped — everything below the fold had no real `src` yet.
 */
function resolveImageSrc(el: Element): string | null {
  for (const attr of LAZY_SRC_ATTRS) {
    const v = el.getAttribute(attr);
    if (v && !PLACEHOLDER_IMAGE_RE.test(v)) return v;
  }
  for (const attr of LAZY_SRCSET_ATTRS) {
    const raw = el.getAttribute(attr);
    const url = raw ? firstUrlFromSrcset(raw) : null;
    if (url && !PLACEHOLDER_IMAGE_RE.test(url)) return url;
  }
  const src = el.getAttribute('src');
  if (src && !src.startsWith('data:image') && !PLACEHOLDER_IMAGE_RE.test(src)) return src;
  return null;
}

/** Search up to 3 levels above `el` for an <img> and return its src. */
function findNearbyImageSrc(el: Element): string | null {
  // First try inside the element itself
  const ownImg = el.querySelector('img');
  if (ownImg) {
    const src = resolveImageSrc(ownImg);
    if (src) return src;
  }

  // Then walk up to 3 levels, checking each ancestor for an <img>
  let current: Element | null = el;
  for (let depth = 0; depth < 3 && current; depth++) {
    const parentEl: Element | null = current.parentElement;
    if (!parentEl) break;
    // Look for an img among the siblings of the current node
    const siblingImg = Array.from(parentEl.children).find(
      (sibling): sibling is HTMLImageElement =>
        sibling instanceof Element && sibling !== current && sibling.tagName === 'IMG',
    );
    const siblingSrc = siblingImg ? resolveImageSrc(siblingImg) : null;
    if (siblingSrc) {
      return siblingSrc;
    }
    // Also check the parent itself (skip if it's the same img already found inside el)
    const parentImg = parentEl.querySelector('img');
    if (parentImg && parentImg !== ownImg) {
      const parentSrc = resolveImageSrc(parentImg);
      if (parentSrc) return parentSrc;
    }
    current = parentEl;
  }

  return null;
}

function extractFieldsFromElement(
  root: Element,
  mappings: FieldMapping[],
): ExtractedProduct | null {
  const product: ExtractedProduct = {};

  for (const mapping of mappings) {
    const isPriceField = /precio|price|amount|cost|costo/i.test(mapping.canonicalField);

    if (isPriceField) {
      let prices: number[] = [];

      // Hybrid approach: try pattern-based detection first (handles fragmented prices)
      const patternPrices = detectPriceByPattern(root);
      if (patternPrices.length > 0) {
        prices = patternPrices;
      } else {
        // Fallback to selector-based approach if pattern detection found nothing
        const allEls = root.querySelectorAll(mapping.selector);
        for (const el of Array.from(allEls)) {
          if (isRatingElement(el) || isNonPriceAmountElement(el)) continue;
          const raw = el.textContent?.trim() ?? '';
          const parsed = parseLocalizedPrice(raw);
          if (parsed !== null && parsed > 0) {
            prices.push(parsed);
          }
        }
      }

      // Select the lowest positive price (filters out "from $X" range refs)
      if (prices.length > 0) {
        product[mapping.canonicalField] = Math.min(...prices);
      }
      continue;
    }

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

/**
 * Extract ALL possible data from a container element — every text, price,
 * image URL, and link. Returns an object with multiple values per category
 * so the user can pick which one to use in the preview.
 */
export function extractAllFromContainer(container: Element): ExtractedProduct {
  const result: ExtractedProduct = {};

  // Helper: get all text content from elements matching a selector,
  // paired with the element itself (so callers can filter by ancestry —
  // e.g. excluding star-rating widgets — not just by text).
  const getAllTextEls = (selector: string): { el: Element; text: string }[] => {
    try {
      return Array.from(container.querySelectorAll(selector))
        .map((el) => ({ el, text: el.textContent?.trim() ?? '' }))
        .filter((r): r is { el: Element; text: string } => r.text.length > 0);
    } catch {
      return [];
    }
  };
  const getAllText = (selector: string): string[] => getAllTextEls(selector).map((r) => r.text);

  // Helper: get all image URLs, lazy-load aware (see resolveImageSrc).
  const getAllImages = (selector: string): string[] => {
    try {
      return Array.from(container.querySelectorAll(selector))
        .map(resolveImageSrc)
        .filter((src): src is string => !!src && src.length > 0);
    } catch {
      return [];
    }
  };

  // Helper: get all href attributes
  const getAllLinks = (selector: string): string[] => {
    try {
      return Array.from(container.querySelectorAll(selector))
        .map(el => (el as HTMLAnchorElement).href)
        .filter((href): href is string => !!href && href.length > 0);
    } catch {
      return [];
    }
  };

  // Prices: hybrid approach with pattern-based detection for fragmented prices
  // (e.g., Temu's $ | 267 | ,88 across multiple spans) plus fallback selector scan.
  //
  //   Pass Pattern — Pattern-based detection: finds currency + numbers across
  //                  multi-span elements. Handles fragmented prices automatically.
  //   Pass A       — Specific price classes/attrs with currency REQUIRED.
  //   Pass A′      — Same classes, no currency required (bare numbers).
  //   Pass B       — Generic span/div scan with currency REQUIRED.
  const collectPrices = (selectors: string[], requireCurrency: boolean): number[] => {
    const found: number[] = [];
    for (const sel of selectors) {
      for (const { el, text } of getAllTextEls(sel)) {
        if (isRatingElement(el) || isNonPriceAmountElement(el)) continue;
        if (requireCurrency && !CURRENCY_RE.test(text)) continue;
        const parsed = parseLocalizedPrice(text);
        if (parsed !== null && parsed > 0) found.push(parsed);
      }
    }
    return found;
  };

  // Try pattern-based detection first (most robust for fragmented prices)
  let allPrices = detectPriceByPattern(container);

  // Fallback to selector-based passes if pattern detection found nothing
  if (allPrices.length === 0) {
    const specificPriceSelectors = [
      '[data-type="price"]', // Temu: explicit price container
      '[class*="price" i]',
      '[class*="precio" i]',
      '[data-price]',
      '[class*="amount" i]',
    ];
    allPrices = collectPrices(specificPriceSelectors, true);
    if (allPrices.length === 0) {
      allPrices = collectPrices(specificPriceSelectors, false);
    }
    if (allPrices.length === 0) {
      allPrices = collectPrices(['span', 'div'], true);
    }
  }

  // Deduplicate and sort
  const uniquePrices = [...new Set(allPrices)].sort((a, b) => a - b);
  if (uniquePrices.length > 0) {
    result['_all_prices'] = uniquePrices;
    result['precio'] = uniquePrices[0]; // lowest price as default (lowercase key)
  }

  // Titles: get all text from heading-like elements
  const titleSelectors = [
    'h1', 'h2', 'h3', 'h4',
    '[class*="title"]',
    '[class*="titulo"]',
    '[class*="name"]',
    '[class*="product"]',
    'a',
  ];
  const allTitles = titleSelectors.flatMap(sel => getAllText(sel));
  // Filter out very short strings and URLs (min 3 chars to include short product names)
  const validTitles = allTitles.filter(t => t.length > 3 && !t.startsWith('http'));
  if (validTitles.length > 0) {
    result['_all_titles'] = validTitles;
    result['titulo'] = validTitles[0];
    result['title'] = validTitles[0];
  }

  // Images
  const imageSelectors = ['img', 'picture source', '[class*="image"]', '[class*="img"]'];
  const allImages = imageSelectors.flatMap(sel => getAllImages(sel));
  // Filter out tiny icons and base64 images (min 20 chars for URLs)
  const validImages = allImages.filter(src =>
    src && !src.includes('data:image') && src.length > 20
  );
  if (validImages.length > 0) {
    result['_all_images'] = validImages;
    result['imagen'] = validImages[0];
    result['image'] = validImages[0];
  }

  // URLs (product links)
  const linkSelectors = ['a', '[href]'];
  const allLinks = linkSelectors.flatMap(sel => getAllLinks(sel));
  const productLinks = allLinks.filter(href =>
    href && !href.includes('javascript') && href.length > 20
  );
  if (productLinks.length > 0) {
    result['_all_urls'] = productLinks;
    result['url'] = productLinks[0];
    result['url_producto'] = productLinks[0];
  }

  // Extra discovery fields — brand, SKU, availability, discount, rating.
  // Best-effort like everything above: a miss just means the key is
  // absent from this product, same as price/title/image/url. These
  // aren't preset canonical roles (see CANONICAL_FIELDS on the
  // frontend) — they show up in the "All Detected Fields" panel so
  // the user can see what else is available to map, even though
  // there's no dedicated dropdown slot for them yet.
  const MAX_SHORT_FIELD_LEN = 60;

  /** First non-empty, reasonably-short text match across `selectors`. */
  const firstShortText = (selectors: string[]): string | null => {
    for (const sel of selectors) {
      for (const { text } of getAllTextEls(sel)) {
        if (text.length > 0 && text.length <= MAX_SHORT_FIELD_LEN) return text;
      }
    }
    return null;
  };

  // Rating needs its own scan (not firstShortText): the value is often
  // conveyed via aria-label ("4.2 out of 5 stars") on an element whose
  // visible text is empty (icon-only star widgets), so text content
  // alone would miss it.
  const ratingSelectors = [
    '[itemprop="ratingValue"]',
    '[class*="rating" i]',
    '[class*="stars" i]',
    '[aria-label*="star" i]',
  ];
  let ratingText: string | null = null;
  for (const sel of ratingSelectors) {
    for (const el of Array.from(container.querySelectorAll(sel))) {
      const text = el.textContent?.trim() ?? '';
      const aria = el.getAttribute('aria-label')?.trim() ?? '';
      const candidate = text.length > 0 ? text : aria;
      if (candidate.length > 0 && candidate.length <= MAX_SHORT_FIELD_LEN) {
        ratingText = candidate;
        break;
      }
    }
    if (ratingText) break;
  }
  if (ratingText) {
    const parsedRating = parseLocalizedPrice(ratingText);
    // Sanity range — a star rating is 0–10; anything outside that is
    // almost certainly a mis-matched selector picking up something else.
    if (parsedRating !== null && parsedRating >= 0 && parsedRating <= 10) {
      result['rating'] = parsedRating;
    }
  }

  const marca = firstShortText(['[itemprop="brand"]', '[class*="brand" i]', '[class*="marca" i]']);
  if (marca) result['marca'] = marca;

  const skuAttr = container.querySelector('[data-sku]')?.getAttribute('data-sku')?.trim();
  const sku = skuAttr || firstShortText(['[itemprop="sku"]', '[class*="sku" i]']);
  if (sku) result['sku'] = sku;

  const disponibilidad = firstShortText([
    '[itemprop="availability"]',
    '[class*="stock" i]',
    '[class*="disponib" i]',
    '[class*="availability" i]',
  ]);
  if (disponibilidad) result['disponibilidad'] = disponibilidad;

  const descuento = firstShortText(['[class*="discount" i]', '[class*="descuento" i]']);
  if (descuento) result['descuento'] = descuento;

  // Any other text that might be useful
  const allText = container.textContent?.trim() ?? '';
  if (allText.length > 0) {
    result['_raw_text'] = allText;
  }

  return result;
}

/**
 * Domain rules saved from the extractAll (container-only) methodology
 * carry no real per-field selector — the frontend patches the empty
 * string to this placeholder before persisting, because the backend's
 * FieldMappingDto requires a non-empty selector. It is never a usable
 * CSS selector; `hasRealFieldMappings` treats it the same as "no
 * mapping at all" so replay falls through to extractAllFromContainer
 * instead of querying for a selector that can never match anything.
 */
const EXTRACT_ALL_PLACEHOLDER_SELECTOR = '[extractAll]';

function hasRealFieldMappings(mappings: FieldMapping[]): boolean {
  return mappings.some((m) => m.selector && m.selector !== EXTRACT_ALL_PLACEHOLDER_SELECTOR);
}

/**
 * Extract products using field mappings. When no *real* mappings are
 * defined (empty, or the extractAll placeholder), falls back to
 * extractAllFromContainer for each container child — this is what
 * makes scheduled auto-replay work for rules saved via the
 * container-only methodology, not just the interactive first run.
 *
 * Exported for unit testing.
 */
export function extractProducts(rule: DomainRule): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];
  const useFieldMappings = hasRealFieldMappings(rule.fieldMappings);

  // ── 1. Container-child iteration ────────────────────────────────
  const containers = document.querySelectorAll(rule.containerSelector);
  containers.forEach((container) => {
    const items = Array.from(container.children).filter(
      (child) => child.children.length > 0,
    );

    if (items.length > 0) {
      for (const item of items) {
        const p = useFieldMappings
          ? extractFieldsFromElement(item, rule.fieldMappings)
          : extractAllFromContainer(item);
        if (p && Object.keys(p).length > 0) products.push(p);
      }
    } else {
      const p = useFieldMappings
        ? extractFieldsFromElement(container, rule.fieldMappings)
        : extractAllFromContainer(container);
      if (p && Object.keys(p).length > 0) products.push(p);
    }
  });

  // ── 2. Global index grouping ────────────────────────────────────
  if (useFieldMappings) {
    const globals = extractProductsGlobal(rule.fieldMappings);
    if (globals.length > 0) return globals;
  }

  return products;
}

void currentTarget;
