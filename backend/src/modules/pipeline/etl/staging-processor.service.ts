/**
 * StagingProcessorService — raw JSON → staging layer (ETL-1).
 *
 * Ported from legacy `legacy/pipeline/scripts/staging/run_all.ts`
 * (compiled output preserved at `legacy/pipeline/dist/`, source
 * deleted in PR 1b): reads the latest raw dump per source, normalises
 * field names, standardises dates, converts prices to USD, classifies
 * categories, deduplicates, and writes the two canonical staging
 * files. Logic ported, not duplicated (ETL-1).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type {
  IStagingProcessor,
  StagingOptions,
  StagingResult,
} from '../interfaces';
import { normalizeColumns } from './staging/stg-normalize-columns';
import { standardizeDates } from './staging/stg-dates';
import { loadRates, cleanAndConvertToUsd } from './staging/stg-currency';
import { deduplicate } from './staging/stg-dedup';
import { classifyCategory } from './etl.constants';

const DATE_COLS = ['_extraido_en', 'fecha_publicacion', 'Timestamp'];
const PRODUCT_SOURCES: ReadonlyArray<PipelineSource> = [
  PipelineSource.MERCADOLIBRE,
  PipelineSource.ALIEXPRESS,
  PipelineSource.TEMU,
  PipelineSource.SHEIN,
  PipelineSource.CSV_DATASET,
];
const PRODUCT_DEDUP_KEYS = ['titulo_oferta', 'precio_raw', '_fuente'] as const;
const ENCUESTA_DEDUP_KEYS = [
  'edad',
  'genero',
  'frecuencia_compra',
  'sitio_preferido',
  'gasto_promedio_mensual',
] as const;

@Injectable()
export class StagingProcessorService implements IStagingProcessor {
  private readonly logger = new Logger(StagingProcessorService.name);

  constructor(private readonly configService: ConfigService) {}

  async run(opts?: StagingOptions): Promise<StagingResult> {
    const start = Date.now();
    const rawDir = this.resolveDir(
      opts?.inputDir,
      'PIPELINE_RAW_DIR',
      'pipeline/raw',
    );
    const stagingDir = this.resolveDir(
      opts?.outputDir,
      'PIPELINE_STAGING_DIR',
      'pipeline/staging',
    );
    await fs.mkdir(stagingDir, { recursive: true });

    const rates = loadRates(rawDir);

    const allRecords: Record<string, unknown>[] = [];
    for (const source of PRODUCT_SOURCES) {
      const raw = await this.loadLatestRaw(path.join(rawDir, source), source);
      if (!raw.length) {
        this.logger.warn(`Sin datos para la fuente ${source}`);
        continue;
      }
      for (const record of raw) {
        try {
          allRecords.push(this.transformProduct(record, source, rates));
        } catch (err) {
          this.logger.error(
            `TransformError (${source}): ${(err as Error).message} — registro omitido`,
          );
        }
      }
    }

    const { data: dedupedProducts, removed: prodRemoved } = deduplicate(
      allRecords,
      PRODUCT_DEDUP_KEYS,
    );
    this.logger.log(
      `Productos: ${allRecords.length} antes de deduplicar, ${prodRemoved} duplicados eliminados, ${dedupedProducts.length} en staging`,
    );
    await fs.writeFile(
      path.join(stagingDir, 'all_products.json'),
      JSON.stringify(dedupedProducts, null, 2),
      'utf-8',
    );

    let encuestaCount = 0;
    const rawEncuestas = await this.loadLatestRaw(
      path.join(rawDir, PipelineSource.ENCUESTA),
      PipelineSource.ENCUESTA,
    );
    if (rawEncuestas.length) {
      const processedEncuestas: Record<string, unknown>[] = [];
      for (const record of rawEncuestas) {
        try {
          const r = this.normalizeStrings({ ...record });
          r['_fuente'] = PipelineSource.ENCUESTA;
          processedEncuestas.push(r);
        } catch (err) {
          this.logger.error(
            `TransformError (encuesta): ${(err as Error).message} — registro omitido`,
          );
        }
      }
      const { data: dedupedEncuestas, removed: encRemoved } = deduplicate(
        processedEncuestas,
        ENCUESTA_DEDUP_KEYS,
      );
      this.logger.log(
        `Encuestas: ${rawEncuestas.length} antes de deduplicar, ${encRemoved} duplicados eliminados, ${dedupedEncuestas.length} en staging`,
      );
      await fs.writeFile(
        path.join(stagingDir, 'stg_encuesta.json'),
        JSON.stringify(dedupedEncuestas, null, 2),
        'utf-8',
      );
      encuestaCount = dedupedEncuestas.length;
    } else {
      this.logger.warn('Sin datos de encuesta para procesar');
    }

    return {
      totalProductos: dedupedProducts.length,
      totalEncuestas: encuestaCount,
      durationMs: Date.now() - start,
    };
  }

  private transformProduct(
    record: Record<string, unknown>,
    source: PipelineSource,
    rates: Record<string, number>,
  ): Record<string, unknown> {
    let r = normalizeColumns(record);
    if (!r['_fuente']) r['_fuente'] = source;
    r = standardizeDates(r, DATE_COLS);
    const moneda = typeof r['moneda'] === 'string' ? r['moneda'] : 'USD';
    r['precio_usd'] = cleanAndConvertToUsd(r['precio_raw'], moneda, rates);
    r = this.normalizeStrings(r);
    r['categoria_normalizada'] = classifyCategory(
      typeof r['titulo_oferta'] === 'string' ? r['titulo_oferta'] : null,
    );
    return r;
  }

  private normalizeStrings(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value === 'string') {
        record[key] = value.trim().normalize('NFC');
      }
    }
    return record;
  }

  /** Load the most recent `<prefix>_*.json` raw dump from a source directory. */
  private async loadLatestRaw(
    dirPath: string,
    prefix: string,
  ): Promise<Record<string, unknown>[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(dirPath);
    } catch {
      return [];
    }
    const files = entries
      .filter(
        (f) =>
          f.endsWith('.json') &&
          f.startsWith(prefix) &&
          !f.includes('extension_export'),
      )
      .sort()
      .reverse();
    if (!files.length) return [];
    const filePath = path.join(dirPath, files[0]);
    const data: unknown = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    if (!Array.isArray(data)) return [];
    this.logger.log(
      `Cargado ${prefix}: ${data.length} registros (${files[0]})`,
    );
    return data as Record<string, unknown>[];
  }

  /**
   * `opts.inputDir`/`opts.outputDir` are full overrides (used by unit
   * tests to point at a tmp dir) — used as-is when given. Otherwise
   * falls back to the env var, and if that's unset too, to a path
   * relative to the app's own cwd (NestJS runs with cwd already at
   * `backend/`, so a repo-root-relative fallback would double-nest
   * into `backend/backend/...` — same fix as mercadolibre.ts's
   * resolveRawDir).
   */
  private resolveDir(
    explicit: string | undefined,
    envVar: string,
    fallback: string,
  ): string {
    if (explicit) return explicit;
    return this.configService.get<string>(envVar) ?? fallback;
  }
}

if (require.main === module) {
  const configService = new ConfigService();
  new StagingProcessorService(configService)
    .run()
    .then((result) => {
      console.log(
        `staging: productos=${result.totalProductos} encuestas=${result.totalEncuestas} durationMs=${result.durationMs}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('staging: fatal', err);
      process.exit(1);
    });
}
