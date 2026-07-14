import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DW_LOADER,
  DATA_SOURCES,
  STAGING_PROCESSOR,
} from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type {
  IDwLoader,
  IDataSource,
  IStagingProcessor,
  LoadResult,
  PipelineRunSummary,
  ScrapeResult,
  SourceConfig,
  StagingResult,
} from './interfaces';

/**
 * PipelineService — orchestrator for the seven scrapers, the
 * staging processor, and the DW loader. Each piece is injected by
 * token (DW_LOADER, DATA_SOURCES array, STAGING_PROCESSOR) so the
 * concrete adapters can be swapped freely.
 *
 * Methods:
 *   - `runAll()`         → scrape everything + staging + DW load
 *   - `runScraper()`     → run one scraper by source
 *   - `runStaging()`     → staging only
 *   - `loadDw()`         → DW load only
 *   - `getAvailableSources()` → list the seven PipelineSource enum values
 *
 * The five endpoints mirror this 1:1 in `pipeline.controller.ts`.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @Inject(DW_LOADER) private readonly dwLoader: IDwLoader,
    @Inject(DATA_SOURCES) private readonly dataSources: IDataSource[],
    @Inject(STAGING_PROCESSOR) private readonly staging: IStagingProcessor,
  ) {}

  /** All PipelineSource enum values, in declaration order. */
  getAvailableSources(): PipelineSource[] {
    return [
      PipelineSource.MERCADOLIBRE,
      PipelineSource.ALIEXPRESS,
      PipelineSource.TEMU,
      PipelineSource.SHEIN,
      PipelineSource.API_RATES,
      PipelineSource.CSV_DATASET,
      PipelineSource.ENCUESTA,
    ];
  }

  /**
   * Find the adapter that owns a given source. Throws if none was
   * registered (defensive — the module wires all seven at startup,
   * so this only fires on programmer error).
   */
  private pickSource(source: PipelineSource): IDataSource {
    const adapter = this.dataSources.find((ds) => ds.source === source);
    if (!adapter) {
      throw new Error(
        `No data source adapter registered for ${source}. ` +
          `Registered: ${this.dataSources.map((d) => d.source).join(', ')}`,
      );
    }
    return adapter;
  }

  /** Run one scraper by source. Throws on unknown source. */
  async runScraper(
    source: PipelineSource,
    config: SourceConfig,
  ): Promise<ScrapeResult> {
    const adapter = this.pickSource(source);
    if (adapter.source !== config.source) {
      // Defensive — keep the config and the adapter in sync so callers
      // can't accidentally send a Meli config to an Ali adapter.
      throw new Error(
        `Source mismatch: adapter=${adapter.source}, config=${config.source}`,
      );
    }
    return adapter.run(config);
  }

  /** Run only the staging transform (raw → staging). */
  async runStaging(opts?: {
    inputDir?: string;
    outputDir?: string;
    source?: string;
  }): Promise<StagingResult> {
    return this.staging.run(opts);
  }

  /** Run only the DW loader (staging → dw.*). */
  async loadDw(opts?: {
    truncateFirst?: boolean;
    inMemoryData?: {
      productos?: Record<string, unknown>[];
      encuestas?: Record<string, unknown>[];
    };
  }): Promise<LoadResult> {
    return this.dwLoader.load(opts);
  }

  /**
   * Full pipeline: scrape every registered source in parallel → run
   * staging → load the DW. Each phase's errors are surfaced via the
   * returned envelope rather than thrown so the dashboard can render
   * a partial-success summary.
   */
  async runAll(opts?: {
    sources?: PipelineSource[];
    stagingOpts?: { inputDir?: string; outputDir?: string };
    loadOpts?: { truncateFirst?: boolean };
  }): Promise<PipelineRunSummary> {
    const start = Date.now();
    const requested = opts?.sources ?? this.getAvailableSources();
    const adapters = requested.map((s) => this.pickSource(s));

    this.logger.log(`runAll starting: ${requested.length} sources`);

    // Fan-out all scrapers in parallel. outputDir is just the bare
    // source name — each scraper joins it onto PIPELINE_RAW_DIR itself
    // (resolveRawDir), so the real layout is PIPELINE_RAW_DIR/<source>/.
    // A hardcoded 'pipeline/raw/scraping/<source>' here would double-nest
    // under PIPELINE_RAW_DIR (same bug class fixed in mercadolibre.ts's
    // resolveRawDir — see pipeline-consolidation PR 3).
    const scrapeResults = await Promise.all(
      adapters.map((adapter) => {
        const cfg: SourceConfig = {
          source: adapter.source,
          outputDir: adapter.source,
        };
        return adapter.run(cfg).catch((err: any) => ({
          source: adapter.source,
          totalScraped: 0,
          outputPath: '',
          durationMs: 0,
          errors: [(err as Error).message ?? String(err)],
        }));
      }),
    );

    this.logger.log(
      `runAll scrapes done in ${scrapeResults.reduce((acc: number, r: ScrapeResult) => acc + r.durationMs, 0)}ms`,
    );

    // Staging is sequential by design (single writer to disk).
    let stagingResult: StagingResult | undefined;
    try {
      stagingResult = await this.staging.run(opts?.stagingOpts);
    } catch (err) {
      this.logger.error(`Staging failed: ${(err as Error).message}`);
    }

    // DW load — bounded by staging success.
    let loadResult: LoadResult | undefined;
    if (stagingResult) {
      try {
        loadResult = await this.dwLoader.load(opts?.loadOpts);
      } catch (err) {
        this.logger.error(`DW load failed: ${(err as Error).message}`);
        loadResult = {
          productosCargados: 0,
          encuestasCargadas: 0,
          tiempoMs: 0,
          estado: 'fallido',
          error: (err as Error).message?.slice(0, 500),
        };
      }
    }

    return {
      scrapeResults,
      stagingResult: stagingResult
        ? {
            totalProductos: stagingResult.totalProductos,
            totalEncuestas: stagingResult.totalEncuestas,
            durationMs: stagingResult.durationMs,
          }
        : undefined,
      loadResult,
      totalDurationMs: Date.now() - start,
    };
  }
}
