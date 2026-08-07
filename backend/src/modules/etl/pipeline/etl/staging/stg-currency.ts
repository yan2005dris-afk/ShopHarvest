/**
 * Loads the latest exchange-rates dump and converts a raw price string
 * to USD. Ported from legacy `stg_currency.ts`; `loadRates` now takes
 * an explicit `rawDir` (resolved by the caller via `ConfigService`)
 * instead of a hardcoded `__dirname`-relative path.
 */
import * as fs from 'fs';
import * as path from 'path';

interface ExchangeRatesFile {
  rates?: Record<string, number>;
  conversion_rates?: Record<string, number>;
}

/** Reads the most recent `exchangerates_*.json` dump under `<rawDir>/api_rates/`. */
export function loadRates(rawDir: string): Record<string, number> {
  const dir = path.join(rawDir, 'api_rates');
  if (!fs.existsSync(dir)) return {};
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('exchangerates_') || f.startsWith('api_rates_'))
    .sort()
    .reverse();
  if (!files.length) return {};
  const data = JSON.parse(
    fs.readFileSync(path.join(dir, files[0]), 'utf-8'),
  ) as ExchangeRatesFile;
  return data.rates ?? data.conversion_rates ?? {};
}

function toPriceString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Parses a raw price string that may contain thousand separators in EITHER
 * US (`,` thousands, `.` decimal: "3,200.50") or EU (`.` thousands, `,`
 * decimal: "1.299,99") conventions, plus an optional magnitude suffix
 * ("$50k", "3.2k").
 *
 * Disambiguation rule (deterministic):
 * - When BOTH separators appear, the LAST one is the decimal separator and
 *   the other(s) are thousands separators.
 * - When only ONE separator appears, a trailing group of exactly 2 digits is
 *   a decimal fraction ("45.99", "3,20"); any other trailing group is a
 *   thousands separator ("1.299" -> 1299, "3,200" -> 3200).
 *
 * Returns null when nothing parseable remains.
 */
export function parsePriceRaw(input: string): number | null {
  const raw = toPriceString(input).trim();
  // Only a `k` directly after a digit/separator is the magnitude suffix
  // (e.g. "$50k", "3.2k") — a stray `k` from currency text ("DKK", "kr")
  // must not be mistaken for it.
  const isK = /[\d.,]\s*k\s*$/i.test(raw);
  const cleaned = (isK ? raw.replace(/k\s*$/i, '') : raw).replace(
    /[^\d.,]/g,
    '',
  );
  if (!cleaned) return null;
  const body = cleaned;

  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');
  let intPart = body;
  let decPart = '';

  if (lastComma !== -1 || lastDot !== -1) {
    const idx = Math.max(lastComma, lastDot);
    intPart = body.slice(0, idx).replace(/[.,]/g, '');
    decPart = body.slice(idx + 1);
    if ((lastComma === -1 || lastDot === -1) && decPart.length > 2) {
      // Trailing group of 3+ digits is a thousands group, not a fraction,
      // but only when a single separator type is present — with BOTH
      // separators the last one is always the decimal one regardless of
      // its digit count (e.g. "1,234.567" -> 1234.567).
      intPart = body.replace(/[.,]/g, '');
      decPart = '';
    }
  }

  let numeric = parseFloat(decPart ? `${intPart || '0'}.${decPart}` : intPart);
  if (isK) numeric *= 1000;
  return Number.isFinite(numeric) ? numeric : null;
}

export interface ConvertedPrice {
  /** USD price rounded to cents, or null when unparseable/unconvertible. */
  usd: number | null;
  /** True when the currency is not USD and no rate exists for it. */
  rateMissing: boolean;
}

/**
 * Converts a raw price to USD. `rateMissing` lets callers distinguish
 * "no rate available" from "unparseable price" so a run never reports
 * SUCCESS with silently-nulled prices.
 */
export function cleanAndConvertToUsd(
  priceRaw: unknown,
  moneda: string,
  rates: Record<string, number>,
): ConvertedPrice {
  if (priceRaw == null) return { usd: null, rateMissing: false };
  const numeric = parsePriceRaw(toPriceString(priceRaw));
  if (numeric === null) return { usd: null, rateMissing: false };
  const currencyCode = moneda.trim().toUpperCase();
  if (currencyCode === 'USD') {
    return { usd: round2(numeric), rateMissing: false };
  }
  const rate = rates[currencyCode];
  if (!rate) return { usd: null, rateMissing: true };
  return { usd: round2(numeric / rate), rateMissing: false };
}
