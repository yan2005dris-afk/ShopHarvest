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

/** Limpia strings sucios ("$50k", "USD 3,200", "€ 45.99") y convierte a USD. */
export function cleanAndConvertToUsd(
  priceRaw: unknown,
  moneda: string,
  rates: Record<string, number>,
): number | null {
  if (priceRaw == null) return null;
  const cleaned = toPriceString(priceRaw)
    .replace(/[^\d.,k]/gi, '')
    .replace(/,(\d{2})$/, '.$1')
    .replace(/,/g, '')
    .replace(/k$/i, '000');
  const numeric = parseFloat(cleaned);
  if (Number.isNaN(numeric)) return null;
  if (moneda === 'USD') return Math.round(numeric * 100) / 100;
  const rate = rates[moneda];
  if (!rate) return null;
  return Math.round((numeric / rate) * 100) / 100;
}
