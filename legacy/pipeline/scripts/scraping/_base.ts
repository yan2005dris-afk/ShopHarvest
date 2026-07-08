import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(min = 2000, max = 5000): Promise<void> {
  return delay(Math.floor(Math.random() * (max - min)) + min);
}

export function saveToRaw(source: string, data: unknown[]): string {
  const date = new Date().toISOString().split('T')[0];
  const dir = path.join(__dirname, `../../raw/scraping/${source}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${source}_${date}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Raw guardado: ${file} — ${data.length} registros`);
  return file;
}

export function logError(
  fuente: string,
  tipo: string,
  descripcion: string,
  accion: string,
): void {
  const logDir = path.join(__dirname, '../../logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'pipeline_errors.log');
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `${ts},${fuente},${tipo},"${descripcion}","${accion}"\n`;
  fs.appendFileSync(logFile, line, 'utf-8');
  console.error(`⚠ Error [${fuente}] ${tipo}: ${descripcion}`);
}

export async function createBrowser() {
  return chromium.launch({ headless: true });
}
