import { describe, expect, it } from 'vitest';
import { parseLocalizedPrice, extractAllFromContainer, extractProducts } from './mapper';
import type { DomainRule } from '../types';

/**
 * Unit tests for the locale-aware price parser. The OLD implementation
 * stripped everything except [0-9.] which turned "19,99" into 1999 and
 * "1.299,00" into 1.299 — both numerically wrong and silently accepted.
 *
 * The new parseLocalizedPrice handles:
 *   - US/UK with period as decimal: "19.99" → 19.99
 *   - European with comma as decimal: "19,99" → 19.99
 *   - European with thousands + decimal: "1.299,00" → 1299.00
 *   - US with thousands + decimal:    "$1,299.00" → 1299.00
 *   - Edge cases: empty, garbage, currency symbols, leading text
 */
describe('parseLocalizedPrice', () => {
  it('parses a US-style decimal ("19.99" → 19.99)', () => {
    expect(parseLocalizedPrice('19.99')).toBe(19.99);
  });

  it('parses a European decimal ("19,99" → 19.99)', () => {
    expect(parseLocalizedPrice('19,99')).toBe(19.99);
  });

  it('parses European thousands + decimal ("1.299,00" → 1299.00)', () => {
    expect(parseLocalizedPrice('1.299,00')).toBe(1299.00);
  });

  it('parses US thousands + decimal ("1,299.00" → 1299.00)', () => {
    expect(parseLocalizedPrice('1,299.00')).toBe(1299.00);
  });

  it('strips a currency symbol ("$1,299.00" → 1299.00)', () => {
    expect(parseLocalizedPrice('$1,299.00')).toBe(1299.00);
  });

  it('parses a Brazilian-style "R$ 1.299,00"', () => {
    expect(parseLocalizedPrice('R$ 1.299,00')).toBe(1299.00);
  });

  it('returns null for empty / whitespace input (caller keeps raw string)', () => {
    expect(parseLocalizedPrice('')).toBeNull();
    expect(parseLocalizedPrice('   ')).toBeNull();
  });

  it('returns null when no digits remain after stripping', () => {
    expect(parseLocalizedPrice('gratis')).toBeNull();
    expect(parseLocalizedPrice('free')).toBeNull();
  });

  it('handles leading text like "Price: 9.99"', () => {
    expect(parseLocalizedPrice('Price: 9.99')).toBe(9.99);
  });

  it('handles trailing currency like "9.99 USD"', () => {
    expect(parseLocalizedPrice('9.99 USD')).toBe(9.99);
  });

  it('parses a plain integer', () => {
    expect(parseLocalizedPrice('150')).toBe(150);
  });

  it('parses a price with the European currency suffix ("19,99 €")', () => {
    expect(parseLocalizedPrice('19,99 €')).toBe(19.99);
  });
});

/**
 * Regression tests for the rating-vs-price bug: a star rating like "4.5"
 * parses as a valid number just like a price, and being the smaller
 * number it used to win the old Math.min() over "every number on the
 * card" — so the product's `precio` field ended up holding the rating
 * instead of the real price.
 */
describe('extractAllFromContainer — price detection ignores star ratings', () => {
  function containerFrom(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
  }

  it('picks the real price, not the star rating, when both are plain numbers', () => {
    const container = containerFrom(`
      <div class="product-price">29.99</div>
      <div class="rating-stars">4.5</div>
    `);
    const result = extractAllFromContainer(container);
    expect(result['precio']).toBe(29.99);
  });

  it('ignores a rating flagged via aria-label', () => {
    const container = containerFrom(`
      <span class="price">49.99</span>
      <span aria-label="4.2 out of 5 stars">4.2</span>
    `);
    const result = extractAllFromContainer(container);
    expect(result['precio']).toBe(49.99);
  });

  it('ignores a rating flagged via itemprop="ratingValue"', () => {
    const container = containerFrom(`
      <div class="amount">15.50</div>
      <span itemprop="ratingValue">3.9</span>
    `);
    const result = extractAllFromContainer(container);
    expect(result['precio']).toBe(15.5);
  });

  it('requires a currency symbol in the generic span/div fallback pass', () => {
    // No dedicated price/amount class anywhere — falls back to the
    // generic span/div scan, which must require a currency symbol so a
    // bare "4.8" rating can't be mistaken for a price.
    const container = containerFrom(`
      <div class="review-score">4.8</div>
      <span>$12.00</span>
    `);
    const result = extractAllFromContainer(container);
    expect(result['precio']).toBe(12);
  });
});

/**
 * Regression tests for scheduled auto-replay of domain rules saved via
 * the container-only methodology: `saveDomainRule` patches the empty
 * selector to '[extractAll]' because the backend requires a non-empty
 * selector. Without the hasRealFieldMappings() fallback, extractProducts
 * would try `querySelectorAll('[extractAll]')` (valid CSS, matches
 * nothing) instead of falling through to extractAllFromContainer — so
 * scheduled replay would silently return zero products forever.
 */
describe('extractProducts — falls back to extractAll for placeholder-selector rules', () => {
  function ruleFor(containerSelector: string, fieldMappings: DomainRule['fieldMappings']): DomainRule {
    return { domain: 'example.com', containerSelector, fieldMappings, createdAt: 0, updatedAt: 0 };
  }

  it('extracts products when fieldMappings only contain the extractAll placeholder selector', () => {
    document.body.innerHTML = `
      <div class="products">
        <div class="card"><span class="price">19.99</span><h3 class="title">Widget</h3></div>
        <div class="card"><span class="price">29.99</span><h3 class="title">Gadget</h3></div>
      </div>
    `;
    const rule = ruleFor('.products', [
      { canonicalField: 'precio', selector: '[extractAll]', type: 'text' },
      { canonicalField: 'titulo', selector: '[extractAll]', type: 'text' },
    ]);

    const products = extractProducts(rule);
    expect(products).toHaveLength(2);
    expect(products[0]['precio']).toBe(19.99);
    expect(products[1]['precio']).toBe(29.99);
  });

  it('still uses real selectors when a legacy manually-mapped rule has them', () => {
    document.body.innerHTML = `
      <div class="products">
        <div class="card"><span class="price">19.99</span><h3 class="title">Widget</h3></div>
      </div>
    `;
    const rule = ruleFor('.products', [
      { canonicalField: 'precio', selector: '.price', type: 'text' },
      { canonicalField: 'titulo', selector: '.title', type: 'text' },
    ]);

    const products = extractProducts(rule);
    expect(products).toHaveLength(1);
    expect(products[0]['precio']).toBe(19.99);
    expect(products[0]['titulo']).toBe('Widget');
  });
});

/**
 * Regression tests for the "only ~10 images scraped, rest missing" bug:
 * lazy-load libraries leave `src` unset (or pointing at a placeholder)
 * until the <img> scrolls into the viewport, and the real URL lives in
 * `data-src` / `srcset` instead. The old code read the DOM `.src`
 * *property* (which silently resolves a missing attribute to the page's
 * own URL) and never checked those lazy-load attributes at all — so
 * only images already loaded on the initial viewport came through.
 */
describe('extractAllFromContainer — image detection is lazy-load aware', () => {
  function containerFrom(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
  }

  it('prefers data-src over an unset src attribute', () => {
    const container = containerFrom(`
      <img data-src="https://cdn.example.com/real-product.jpg" alt="" />
    `);
    const result = extractAllFromContainer(container);
    expect(result['imagen']).toBe('https://cdn.example.com/real-product.jpg');
  });

  it('prefers data-src over a placeholder src', () => {
    const container = containerFrom(`
      <img src="https://cdn.example.com/placeholder.gif" data-src="https://cdn.example.com/real.jpg" alt="" />
    `);
    const result = extractAllFromContainer(container);
    expect(result['imagen']).toBe('https://cdn.example.com/real.jpg');
  });

  it('falls back to the first URL in srcset when there is no data-src', () => {
    const container = containerFrom(`
      <img srcset="https://cdn.example.com/small.jpg 480w, https://cdn.example.com/large.jpg 800w" alt="" />
    `);
    const result = extractAllFromContainer(container);
    expect(result['imagen']).toBe('https://cdn.example.com/small.jpg');
  });

  it('falls back to a real src attribute when no lazy-load attribute is present', () => {
    const container = containerFrom(`
      <img src="https://cdn.example.com/eager.jpg" alt="" />
    `);
    const result = extractAllFromContainer(container);
    expect(result['imagen']).toBe('https://cdn.example.com/eager.jpg');
  });

  it('skips an img with no usable src at all (does not fall back to the page URL)', () => {
    const container = containerFrom(`<img alt="" />`);
    const result = extractAllFromContainer(container);
    expect(result['imagen']).toBeUndefined();
  });

  it('reads srcset off a <picture><source> element', () => {
    const container = containerFrom(`
      <picture>
        <source srcset="https://cdn.example.com/webp.webp 1x" type="image/webp" />
        <img src="https://cdn.example.com/fallback.jpg" alt="" />
      </picture>
    `);
    const result = extractAllFromContainer(container);
    expect(result['_all_images']).toContain('https://cdn.example.com/webp.webp');
  });
});
