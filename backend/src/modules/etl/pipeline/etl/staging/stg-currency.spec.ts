import { cleanAndConvertToUsd, parsePriceRaw } from './stg-currency';

describe('parsePriceRaw', () => {
  it.each([
    ['plain integer', '1299', 1299],
    ['decimal (dot)', '45.99', 45.99],
    ['USD thousands separator (comma)', 'USD 3,200', 3200],
    ['USD thousands + cents', '3,200.50', 3200.5],
    ['EU thousand separator (dot)', '1.299', 1299],
    ['EU thousands + decimal comma', '1.299,99', 1299.99],
    ['EU decimal comma short', '3,20', 3.2],
    ['multi-group dots', '1.299.900', 1299900],
    ['currency symbol prefix', '€45.99', 45.99],
    ['k suffix', '$50k', 50000],
    ['k decimal suffix', '3.2k', 3200],
    ['plain', '"200"', 200],
    ['mixed separators, 3-digit fraction', '1,234.567', 1234.567],
  ])('%s -> %s', (_name, input, expected) => {
    expect(parsePriceRaw(input as string)).toBe(expected);
  });

  it('does not mistake a currency-code "k" for the magnitude suffix', () => {
    expect(parsePriceRaw('DKK 100')).toBe(100);
  });

  it('does not mistake a currency-suffix "kr" for the magnitude suffix', () => {
    expect(parsePriceRaw('100 kr')).toBe(100);
  });

  it('returns null for empty / non-price input', () => {
    expect(parsePriceRaw('')).toBeNull();
    expect(parsePriceRaw('---')).toBeNull();
    expect(parsePriceRaw('  ')).toBeNull();
  });

  it('does NOT corrupt a plain 3-decimal-less integer price', () => {
    expect(parsePriceRaw('1299')).toBe(1299);
  });
});

describe('cleanAndConvertToUsd', () => {
  const rates = { EUR: 0.85, GBP: 0.73 };

  it('passes USD prices through without a rate lookup', () => {
    expect(cleanAndConvertToUsd('19.99', 'USD', rates)).toEqual({
      usd: 19.99,
      rateMissing: false,
    });
  });

  it('converts a non-USD price using the matching rate (rounded to cents)', () => {
    expect(cleanAndConvertToUsd('45.5', 'EUR', rates)).toEqual({
      usd: 53.53,
      rateMissing: false,
    });
  });

  it('flags rateMissing when the currency has no rate', () => {
    expect(cleanAndConvertToUsd('45.5', 'BRL', rates)).toEqual({
      usd: null,
      rateMissing: true,
    });
  });

  it('returns null (not rateMissing) for an unparseable price', () => {
    expect(cleanAndConvertToUsd('no price', 'EUR', rates)).toEqual({
      usd: null,
      rateMissing: false,
    });
    expect(cleanAndConvertToUsd(null, 'EUR', rates)).toEqual({
      usd: null,
      rateMissing: false,
    });
  });
});