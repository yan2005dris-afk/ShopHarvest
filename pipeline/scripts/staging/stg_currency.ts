import * as fs from 'fs';
import * as path from 'path';

export function loadRates(): Record<string, number> {
  // Busca el archivo de tasas más reciente en raw/api/
  const dir = path.join(__dirname, '../../raw/api');
  if (!fs.existsSync(dir)) return {};

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('exchangerates_'))
    .sort()
    .reverse();

  if (!files.length) return {};

  const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'));
  return data.rates ?? data.conversion_rates ?? {};
}

// Limpia strings sucios ("$50k", "USD 3,200", "€ 45.99") y convierte a USD
export function cleanAndConvertToUsd(
  priceRaw: string | number | null,
  moneda: string,
  rates: Record<string, number>,
): number | null {
  if (priceRaw == null) return null;

  const cleaned = String(priceRaw)
    .replace(/[^\d.,k]/gi, '')   // quitar símbolos de moneda
    .replace(/,(\d{2})$/, '.$1') // coma decimal europea → punto
    .replace(/,/g, '')            // separadores de miles
    .replace(/k$/i, '000');       // "50k" → "50000"

  const numeric = parseFloat(cleaned);
  if (isNaN(numeric)) return null;
  if (moneda === 'USD') return Math.round(numeric * 100) / 100;

  const rate = rates[moneda];
  if (!rate) return null;
  return Math.round((numeric / rate) * 100) / 100;
}
