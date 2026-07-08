/**
 * Source — CSV dataset loader (Kaggle u otro dataset público).
 *
 * Dual-use: pure module (`loadCsvDataset(config)`) + CLI self-execution.
 *
 * Busca el CSV en `config.extra.inputPath` (CLI default:
 * `pipeline/raw/archivos/dataset_original.csv`). Si no existe, emite
 * un warning, registra en `logs/pipeline_errors.log` y devuelve
 * `totalScraped: 0` en lugar de tirar — preserva idempotencia del
 * pipeline completo cuando todavía no hay dataset cargado.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { logError } from './_base';

export async function loadCsvDataset(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const errors: string[] = [];
  const inputPath =
    (config.extra && typeof config.extra['inputPath'] === 'string'
      ? (config.extra['inputPath'] as string)
      : path.join(process.cwd(), 'pipeline/raw/archivos/dataset_original.csv'));

  if (!fs.existsSync(inputPath)) {
    const msg = `Dataset no encontrado: ${inputPath}`;
    console.warn(`⚠ ${msg}`);
    console.warn('  Descarga un dataset CSV de e-commerce de Kaggle y colócalo ahí.');
    logError('csv-dataset', 'FileNotFound', msg, 'Descargar dataset de Kaggle');
    errors.push(msg);
    return {
      source: PipelineSource.CSV_DATASET,
      totalScraped: 0,
      outputPath: '',
      durationMs: Date.now() - start,
      errors,
    };
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Filas cargadas: ${records.length}`);
  console.log(`Columnas: ${records[0] ? Object.keys(records[0]).join(', ') : '(empty)'}`);
  console.log(`Tamaño archivo: ${(fs.statSync(inputPath).size / 1024).toFixed(1)} KB`);

  const outputDir = config.outputDir
    ? path.isAbsolute(config.outputDir)
      ? config.outputDir
      : path.join(process.cwd(), config.outputDir)
    : path.join(process.cwd(), 'pipeline/raw/archivos');
  fs.mkdirSync(outputDir, { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  const outFile = path.join(outputDir, `dataset_${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`✓ Dataset guardado en Raw: ${outFile}`);

  return {
    source: PipelineSource.CSV_DATASET,
    totalScraped: records.length,
    outputPath: outFile,
    durationMs: Date.now() - start,
    errors,
  };
}

if (require.main === module) {
  loadCsvDataset({
    source: PipelineSource.CSV_DATASET,
    outputDir: 'pipeline/raw/archivos',
    extra: { inputPath: path.join(process.cwd(), 'pipeline/raw/archivos/dataset_original.csv') },
  }).catch(err => {
    logError('csv-dataset', 'FatalError', (err as Error).message, 'Proceso terminado');
    process.exit(1);
  });
}
