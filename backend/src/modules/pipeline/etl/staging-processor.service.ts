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
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';
import { RawCaptureStatus } from '../../../generated/operational';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly operationalPrisma: OperationalPrismaService,
  ) {}

  async extractRawPayloads(source?: string) {
    const where: any = {
      status: {
        in: [RawCaptureStatus.UNPROCESSED, RawCaptureStatus.FAILED],
      },
      attempts: {
        lt: 3,
      },
    };
    if (source && source !== 'all') {
      const cleanSource = source.includes('.') ? source.split('.')[0] : source;
      where.source = {
        code: {
          contains: cleanSource,
          mode: 'insensitive',
        },
      };
    }
    return this.operationalPrisma.rawCapture.findMany({
      where,
      include: {
        source: true,
        offer: true,
      },
    });
  }

  async run(opts?: StagingOptions & { source?: string }): Promise<StagingResult> {
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
    const rawCaptures = await this.extractRawPayloads(opts?.source);

    for (const rawCapture of rawCaptures) {
      const sourceCode = (rawCapture.source?.code || PipelineSource.MERCADOLIBRE) as PipelineSource;
      const payload = rawCapture.payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        this.logger.error(
          `Payload de RawCapture inválido para offerId ${rawCapture.offerId}`,
        );
        continue;
      }
      try {
        const record = { ...payload } as Record<string, unknown>;
        
        // Backfill URL from Offer when missing in the raw payload
        if (!record['url'] && !record['link'] && !record['url_producto'] && (rawCapture as any).offer) {
          record['url_producto'] = (rawCapture as any).offer.url;
        }

        const transformed = this.transformProduct(record, sourceCode, rates);
        
        // Retain metadata properties _offerId and _sourceId mapped from the matching RawCapture record
        transformed['_offerId'] = rawCapture.offerId;
        transformed['_sourceId'] = rawCapture.sourceId;
        
        allRecords.push(transformed);
      } catch (err) {
        this.logger.error(
          `TransformError (${sourceCode}) para offerId ${rawCapture.offerId}: ${(err as Error).message} — registro omitido`,
        );
        try {
          await this.operationalPrisma.rawCapture.update({
            where: {
              offerId_sourceId: {
                offerId: rawCapture.offerId,
                sourceId: rawCapture.sourceId,
              },
            },
            data: {
              status: RawCaptureStatus.FAILED,
              attempts: {
                increment: 1,
              },
            },
          });
        } catch (updateErr) {
          this.logger.error(
            `Failed to update RawCapture for failed transform: ${(updateErr as Error).message}`,
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
    let dedupedEncuestas: Record<string, unknown>[] = [];
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
      const { data: deduped, removed: encRemoved } = deduplicate(
        processedEncuestas,
        ENCUESTA_DEDUP_KEYS,
      );
      dedupedEncuestas = deduped;
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
      productos: dedupedProducts,
      encuestas: dedupedEncuestas,
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
    fallbackSubpath: string,
  ): string {
    if (explicit) return explicit;
    const envVal = this.configService.get<string>(envVar);
    if (envVal) return envVal;
    return path.join(path.resolve(__dirname, '../../../../'), fallbackSubpath);
  }
}

if (require.main === module) {
  const configService = new ConfigService();
  const operationalPrisma = new OperationalPrismaService();
  new StagingProcessorService(configService, operationalPrisma)
    .run()
    .then(async (result) => {
      console.log(
        `staging: productos=${result.totalProductos} encuestas=${result.totalEncuestas} durationMs=${result.durationMs}`,
      );
      await operationalPrisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('staging: fatal', err);
      await operationalPrisma.$disconnect();
      process.exit(1);
    });
}
