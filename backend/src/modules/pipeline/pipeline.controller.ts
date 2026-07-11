import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import * as path from 'path';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  PipelineSource,
  LoadResult,
  ScrapeResult,
  PipelineRunSummary,
} from '@web-scraping/contracts/pipeline';
import { Public } from '../auth/public.decorator';
import { PipelineService } from './pipeline.service';

/**
 * PipelineController — REST surface for the ETL orchestrator.
 *
 * Only `GET /sources` is `@Public()`. The mutation/execute endpoints
 * (`scrape/:source`, `staging`, `load-dw`, `run-all`) are destructive
 * or resource-intensive (e.g. `load-dw` with `truncateFirst: true`
 * wipes `dw.*`; `run-all` fans out every scraper) and are never
 * called by the dashboard frontend — they require the existing JWT
 * auth (CodeRabbit finding, PR #11).
 *
 * Routes (under `/api/pipeline/`):
 *   - GET  /sources         → list available PipelineSource enum values (public)
 *   - POST /scrape/:source  → run one scraper (body: SourceConfig) (auth required)
 *   - POST /staging         → run staging (auth required)
 *   - POST /load-dw         → run DW loader (auth required)
 *   - POST /run-all         → full pipeline orchestration (auth required)
 */
@ApiTags('Pipeline')
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @ApiOperation({
    summary:
      'Lista las 7 fuentes disponibles para el pipeline ETL (PipelineSource enum).',
  })
  @ApiResponse({ status: 200, type: String, isArray: true })
  @Public()
  @Get('sources')
  getSources(): PipelineSource[] {
    return this.pipelineService.getAvailableSources();
  }

  @ApiOperation({
    summary:
      'Ejecuta el scraper de una fuente. Body: SourceConfig DTO con `outputDir` (path al directorio Raw).',
  })
  @ApiResponse({ status: 200, type: Object })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @HttpCode(200)
  @Post('scrape/:source')
  async scrapeOne(
    @Param('source') source: string,
    @Body()
    config: {
      outputDir: string;
      maxItems?: number;
      extra?: Record<string, unknown>;
    },
  ): Promise<ScrapeResult> {
    // Validate source is on the enum before dispatching — the controller
    // is the boundary that converts URL params into the typed enum.
    const validSource = (Object.values(PipelineSource) as string[]).includes(
      source,
    )
      ? (source as PipelineSource)
      : (() => {
          throw new BadRequestException(
            `Unknown source "${source}". Valid: ${this.pipelineService.getAvailableSources().join(', ')}`,
          );
        })();

    // outputDir must stay a relative path with no ".." segments — an
    // absolute path or a traversal segment would let a caller write
    // scraper output anywhere on disk (the scrapers join it onto
    // PIPELINE_RAW_DIR, or use it verbatim when absolute).
    if (
      path.isAbsolute(config.outputDir) ||
      config.outputDir.split(/[\\/]/).includes('..')
    ) {
      throw new BadRequestException(
        'outputDir must be a relative path with no ".." segments',
      );
    }

    const sourceConfig = {
      source: validSource,
      outputDir: config.outputDir,
      maxItems: config.maxItems,
      extra: config.extra,
    };
    return this.pipelineService.runScraper(validSource, sourceConfig);
  }

  @ApiOperation({ summary: 'Ejecuta la fase de staging (raw → staging JSON).' })
  @ApiResponse({ status: 200, type: Object })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @HttpCode(200)
  @Post('staging')
  async runStaging(
    @Body() opts?: { inputDir?: string; outputDir?: string },
  ): Promise<{
    totalProductos: number;
    totalEncuestas: number;
    durationMs: number;
  }> {
    return this.pipelineService.runStaging(opts);
  }

  @ApiOperation({ summary: 'Ejecuta la carga del DW (staging → dw.*).' })
  @ApiResponse({ status: 200, type: Object })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @HttpCode(200)
  @Post('load-dw')
  async loadDw(@Body() dto?: { truncateFirst?: boolean }): Promise<LoadResult> {
    return this.pipelineService.loadDw({
      truncateFirst: dto?.truncateFirst ?? false,
    });
  }

  @ApiOperation({
    summary:
      'Orquestador completo: scrapea todas las fuentes + staging + carga DW. Body opcional para filtrar fuentes.',
  })
  @ApiResponse({ status: 200, type: Object })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @HttpCode(200)
  @Post('run-all')
  async runAll(
    @Body()
    opts?: {
      sources?: PipelineSource[];
      stagingOpts?: { inputDir?: string; outputDir?: string };
      loadOpts?: { truncateFirst?: boolean };
    },
  ): Promise<PipelineRunSummary> {
    return this.pipelineService.runAll(opts);
  }
}
