import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logError } from './_base';

// Obtén clave gratis en https://www.exchangerate-api.com (1500 req/mes)
// Si no tienes clave, usa la URL sin clave del tier libre (limitado)
const API_KEY = process.env.EXCHANGE_API_KEY ?? '';

async function fetchExchangeRates() {
  const url = API_KEY
    ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`
    : 'https://open.er-api.com/v6/latest/USD'; // alternativa sin clave

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

    const date = new Date().toISOString().split('T')[0];
    const dir = path.join(__dirname, '../../raw/api');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `exchangerates_${date}.json`);
    fs.writeFileSync(file, JSON.stringify(enriched, null, 2), 'utf-8');

    const count = Object.keys(data.rates ?? data.conversion_rates ?? {}).length;
    console.log(`✓ API guardada: ${file} — ${count} monedas`);
  } catch (err: any) {
    logError('exchangerates-api', 'HTTPError', err.message, 'Reintentar o verificar API key');
    throw err;
  }
}

fetchExchangeRates().catch(err => {
  console.error('Error fatal API:', err.message);
  process.exit(1);
});
