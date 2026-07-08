import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { logError } from './_base';

/**
 * Carga la encuesta propia (Google Forms exportado como CSV).
 * Anonimiza campos de identificación personal antes de persistir en Raw.
 * Coloca el CSV exportado en: raw/fuente_propia/encuesta_raw.csv
 */
function loadEncuesta(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠ Encuesta no encontrada: ${inputPath}`);
    console.warn('  Exporta el Google Form como CSV y colócalo ahí.');
    logError('encuesta', 'FileNotFound', `CSV no encontrado: ${inputPath}`, 'Exportar Google Form como CSV');
    return;
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  let records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Registros antes de anonimizar: ${records.length}`);

  // Anonimizar: eliminar campos de identificación personal
  const piiFields = ['nombre', 'email', 'correo', 'Marca temporal', 'Timestamp'];
  records = records.map(r => {
    const clean = { ...r };
    for (const field of piiFields) {
      delete clean[field];
    }
    return clean;
  });

  console.log(`Campos tras anonimización: ${Object.keys(records[0]).join(', ')}`);
  console.log(`Registros: ${records.length}`);

  const date = new Date().toISOString().split('T')[0];
  const dir = path.join(__dirname, '../../raw/fuente_propia');
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `encuesta_${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`✓ Encuesta guardada en Raw: ${outFile}`);
}

const inputPath = path.join(__dirname, '../../raw/fuente_propia/encuesta_raw.csv');
loadEncuesta(inputPath);
