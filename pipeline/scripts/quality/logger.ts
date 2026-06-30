import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(__dirname, '../../logs/pipeline_errors.log');

export function logError(
  fuente: string,
  tipo: string,
  descripcion: string,
  accion: string,
): void {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `${ts},${fuente},${tipo},"${descripcion}","${accion}"\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf-8');
}
