import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { logError } from './_base';

/**
 * Carga un dataset CSV público y lo persiste en Raw.
 * Dataset recomendado: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
 * o cualquier dataset de e-commerce de Kaggle.
 * Coloca el CSV en: raw/archivos/dataset_original.csv
 */
function loadCsvDataset(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠ Dataset no encontrado: ${inputPath}`);
    console.warn('  Descarga un dataset CSV de e-commerce de Kaggle y colócalo ahí.');
    logError('csv-dataset', 'FileNotFound', `CSV no encontrado: ${inputPath}`, 'Descargar dataset de Kaggle');
    return;
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Filas cargadas: ${records.length}`);
  console.log(`Columnas: ${Object.keys(records[0]).join(', ')}`);
  console.log(`Tamaño archivo: ${(fs.statSync(inputPath).size / 1024).toFixed(1)} KB`);

  // Validación mínima de esquema — ajusta las columnas a tu dataset
  const required: string[] = [];
  const missing = required.filter(col => !(col in records[0]));
  if (missing.length) {
    logError('csv-dataset', 'SchemaError', `Columnas faltantes: ${missing}`, 'Revisar dataset');
    throw new Error(`Columnas faltantes: ${missing}`);
  }

  const date = new Date().toISOString().split('T')[0];
  const dir = path.join(__dirname, '../../raw/archivos');
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `dataset_${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`✓ Dataset guardado en Raw: ${outFile}`);
}

const inputPath = path.join(__dirname, '../../raw/archivos/dataset_original.csv');
loadCsvDataset(inputPath);
