import { describe, expect, it } from 'vitest';
import { parseLocalizedPrice } from './mapper';

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
