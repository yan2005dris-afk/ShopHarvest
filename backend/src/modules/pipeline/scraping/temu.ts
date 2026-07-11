/**
 * Reader — Temu extension export (native NestJS, no bridge).
 *
 * Extension-based sources never scrape directly: the Chrome extension
 * captures the export, and this reader just consumes
 * `extension_export.json` from disk. No headless-browser tooling of
 * any kind is involved, and no fallback to any demo target — a
 * missing or malformed export is a hard failure
 * (`BadExtensionExportError`), per EXT-2/EXT-3.
 *
 * Wire contract: returns `ScrapeResult` (per IDataSource) with the
 * `ScraperMetrics` payload attached at `result.metrics`. PR 6's
 * persistence layer reads `result.metrics` to populate `EtlRun`.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ScrapeResult,
  SourceConfig,
  ScraperMetrics,
} from '@web-scraping/contracts/pipeline';
import {
  PipelineSource,
  BadExtensionExportError,
  validateExtensionExport,
} from '@web-scraping/contracts/pipeline';

const DEFAULT_EXPORT_PATH = 'pipeline/extension/extension_export.json';

/**
 * Read and validate the Temu extension export, persist it as-is to
 * `PIPELINE_RAW_DIR/temu/<capturedAt>.json`, and gate success on
 * `products.length > 0` (EXT-6).
 *
 * Throws `BadExtensionExportError` on a missing file (`reason:
 * 'missing'`), unparsable JSON (`reason: 'parse'`), or a schema
 * violation (`reason: 'schema'`) — no retry, no fallback (EXT-2, EXT-3).
 */
export async function readTemuExtensionExport(
  config: SourceConfig,
  configService: ConfigService,
): Promise<ScrapeResult> {
  const logger = new Logger('readTemuExtensionExport');
  const start = Date.now();

  const exportPath =
    configService.get<string>('EXTENSION_EXPORT_PATH') ?? DEFAULT_EXPORT_PATH;
  const rawDir = resolveRawDir(config, configService);

  let raw: string;
  try {
    raw = await fs.readFile(exportPath, 'utf-8');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new BadExtensionExportError('missing', `${exportPath} (${detail})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new BadExtensionExportError('parse', detail);
  }

  const exportData = validateExtensionExport(parsed, 'temu');

  const outputPath = await writeRawJson(
    PipelineSource.TEMU,
    rawDir,
    exportData,
  );

  const durationMs = Date.now() - start;
  const state = exportData.products.length > 0 ? 'success' : 'failed';
  const errors = state === 'failed' ? ['temu: 0 items extracted'] : [];
  const metrics: ScraperMetrics = {
    source: PipelineSource.TEMU,
    itemsExtracted: exportData.products.length,
    durationMs,
    retries: 0,
    state,
    startedAt: new Date(start).toISOString(),
    finishedAt: new Date().toISOString(),
    errors,
  };
  logger.log(
    `metrics: items=${metrics.itemsExtracted} durationMs=${durationMs} state=${state}`,
  );

  return {
    source: PipelineSource.TEMU,
    totalScraped: exportData.products.length,
    outputPath,
    durationMs,
    errors,
    metrics,
  };
}

function resolveRawDir(
  config: SourceConfig,
  configService: ConfigService,
): string {
  // NestJS runs with cwd already at `backend/`, so a repo-root-relative
  // fallback would double-nest into `backend/backend/...` — keep the
  // fallback relative to the app's own cwd instead.
  const envDir =
    configService.get<string>('PIPELINE_RAW_DIR') ?? 'pipeline/raw';
  if (!config.outputDir) {
    return `${envDir}/temu`;
  }
  if (
    config.outputDir.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(config.outputDir)
  ) {
    return config.outputDir;
  }
  return `${envDir}/${config.outputDir}`;
}

async function writeRawJson(
  source: string,
  rawDir: string,
  data: unknown,
): Promise<string> {
  await fs.mkdir(rawDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(rawDir, `${source}_${ts}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  return file;
}

if (require.main === module) {
  const configService = new ConfigService();
  readTemuExtensionExport(
    { source: PipelineSource.TEMU, outputDir: 'cli/temu' },
    configService,
  )
    .then((result) => {
      console.log(
        `temu: items=${result.totalScraped} outputPath=${result.outputPath}`,
      );
      process.exit(result.totalScraped > 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error('temu: fatal', err);
      process.exit(1);
    });
}
