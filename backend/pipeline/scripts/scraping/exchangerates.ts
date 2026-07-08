/**
 * Source — Exchange rates API (open.er-api.com fallback o
 * exchangerate-api.com con clave).
 *
 * Dual-use: pure module (`fetchExchangeRates(config)`) + CLI self-execution.
 *
 * El resultado es un JSON enriquecido con `_fetched_at`, `_endpoint`,
 * `_autenticacion` para auditoría — exactamente el contrato que el
 * stg_currency.ts loader espera en `runStaging`.
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { logError } from './_base';

const API_KEY = process.env['EXCHANGE_API_KEY'] ?? '';

export async function fetchExchangeRates(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const errors: string[] = [];
  const url = API_KEY
    ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`
    : 'https://open.er-api.com/v6/latest/USD';

  console.log(`Consumiendo API: ${url}`);

  try {
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'Accept': 'application/json' },
      params: { base: 'USD' },
    });

    const enriched = {
      ...data,
      _fetched_at: new Date().toISOString(),
      _endpoint: url,
      _autenticacion: API_KEY ? 'API Key' : 'Sin clave (tier libre)',
    };

    const outputDir = config.outputDir
      ? path.isAbsolute(config.outputDir)
        ? config.outputDir
        : path.join(process.cwd(), config.outputDir)
      : path.join(process.cwd(), 'pipeline/raw/api');
    fs.mkdirSync(outputDir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const file = path.join(outputDir, `exchangerates_${date}.json`);
    fs.writeFileSync(file, JSON.stringify(enriched, null, 2), 'utf-8');

    const count = Object.keys((data as { rates?: Record<string, number>; conversion_rates?: Record<string, number> }).rates
      ?? (data as { conversion_rates?: Record<string, number> }).conversion_rates
      ?? {}).length;

    return {
      source: PipelineSource.API_RATES,
      totalScraped: count,
      outputPath: file,
      durationMs: Date.now() - start,
      errors,
    };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    logError('exchangerates-api', 'HTTPError', message, 'Reintentar o verificar API key');
    errors.push(message);
    // Still return a result so callers see the error envelope rather than a throw
    return {
      source: PipelineSource.API_RATES,
      totalScraped: 0,
      outputPath: '',
      durationMs: Date.now() - start,
      errors,
    };
  }
}

if (require.main === module) {
  fetchExchangeRates({
    source: PipelineSource.API_RATES,
    outputDir: 'pipeline/raw/api',
  }).catch(err => {
    console.error('Error fatal API:', (err as Error).message);
    process.exit(1);
  });
}
