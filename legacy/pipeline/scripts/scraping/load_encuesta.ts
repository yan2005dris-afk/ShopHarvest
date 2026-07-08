/**
 * Source — Encuesta propia (Google Forms exportado a CSV).
 *
 * Dual-use: pure module (`loadEncuesta(config)`) + CLI self-execution.
 *
 * Antes de persistir anonimiza campos PII (nombre, email, Timestamp)
 * — invariante crítico para no exponer datos personales.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import type { ScrapeResult, SourceConfig } from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { logError } from './_base';

const PII_FIELDS = ['nombre', 'email', 'correo', 'Marca temporal', 'Timestamp'];

export async function loadEncuesta(config: SourceConfig): Promise<ScrapeResult> {
  const start = Date.now();
  const errors: string[] = [];
  const inputPath =
    (config.extra && typeof config.extra['inputPath'] === 'string'
      ? (config.extra['inputPath'] as string)
      : path.join(process.cwd(), 'pipeline/raw/fuente_propia/encuesta_raw.csv'));

  if (!fs.existsSync(inputPath)) {
    const msg = `Encuesta no encontrada: ${inputPath}`;
    console.warn(`⚠ ${msg}`);
    console.warn('  Exporta el Google Form como CSV y colócalo ahí.');
    logError('encuesta', 'FileNotFound', msg, 'Exportar Google Form como CSV');
    errors.push(msg);
    return {
      source: PipelineSource.ENCUESTA,
      totalScraped: 0,
      outputPath: '',
      durationMs: Date.now() - start,
      errors,
    };
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const recordsBefore = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  console.log(`Registros antes de anonimizar: ${recordsBefore.length}`);

  const anonymized = recordsBefore.map(r => {
    const clean: Record<string, string> = { ...r };
    for (const field of PII_FIELDS) {
      delete clean[field];
    }
    return clean;
  });

  if (anonymized.length > 0) {
    console.log(`Campos tras anonimización: ${Object.keys(anonymized[0]).join(', ')}`);
  }
  console.log(`Registros: ${anonymized.length}`);

  const outputDir = config.outputDir
    ? path.isAbsolute(config.outputDir)
      ? config.outputDir
      : path.join(process.cwd(), config.outputDir)
    : path.join(process.cwd(), 'pipeline/raw/fuente_propia');
  fs.mkdirSync(outputDir, { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  const outFile = path.join(outputDir, `encuesta_${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(anonymized, null, 2), 'utf-8');
  console.log(`✓ Encuesta guardada en Raw: ${outFile}`);

  return {
    source: PipelineSource.ENCUESTA,
    totalScraped: anonymized.length,
    outputPath: outFile,
    durationMs: Date.now() - start,
    errors,
  };
}

if (require.main === module) {
  loadEncuesta({
    source: PipelineSource.ENCUESTA,
    outputDir: 'pipeline/raw/fuente_propia',
    extra: { inputPath: path.join(process.cwd(), 'pipeline/raw/fuente_propia/encuesta_raw.csv') },
  }).catch(err => {
    logError('encuesta', 'FatalError', (err as Error).message, 'Proceso terminado');
    process.exit(1);
  });
}
