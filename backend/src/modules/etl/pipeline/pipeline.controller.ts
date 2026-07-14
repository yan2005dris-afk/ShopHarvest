import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import * as path from 'path';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { interval, Observable, from, map, switchMap, takeWhile, tap, catchError, of, concatMap, mergeMap } from 'rxjs';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  PipelineSource,
  LoadResult,
  ScrapeResult,
  PipelineRunSummary,
} from '@web-scraping/contracts/pipeline';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';
import { Public } from '../../operational/auth/public.decorator';
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';
import { PipelineService } from './pipeline.service';
import { EtlSchedulerService } from './etl-scheduler.service';
import {
  ListEtlRunsQueryDto,
  TriggerEtlRunDto,
  EtlRunResponseDto,
} from './dto/etl-run.dto';
import { SseAuthGuard } from './guards/sse-auth.guard';

/** Terminal EtlRun statuses — once reached, SSE polling ends. */
const TERMINAL_STATUSES = ['SUCCESS', 'FAILED'];
const POLL_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * PipelineController — REST surface for the ETL orchestrator.
 *
 * Only `GET /sources` is `@Public()`. The mutation/execute endpoints
 * (`scrape/:source`, `staging`, `load-dw`, `run-all`) are destructive
 * or resource-intensive and require the existing JWT auth.
 *
 * NEW endpoints (etl-management-dashboard-auth):
 *   - GET  /etl-runs          → paginated run list with filters
 *   - GET  /etl-runs/:id      → single run detail
 *   - POST /etl-runs/trigger  → manual ETL trigger
 *   - GET  /etl-runs/:id/stream → SSE progress stream
 *
 * Routes are under `/api/pipeline/` (from @Controller('pipeline')).
 */
@ApiTags('Pipeline')
@Controller('pipeline')
export class PipelineController {
  private readonly logger = new Logger(PipelineController.name);

  constructor(
    private readonly pipelineService: PipelineService,
    private readonly prisma: OperationalPrismaService,
    private readonly scheduler: EtlSchedulerService,
  ) {}

  // ── Existing endpoints ───────────────────────────────────────────

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
    const validSource = (Object.values(PipelineSource) as string[]).includes(
      source,
    )
      ? (source as PipelineSource)
      : (() => {
          throw new BadRequestException(
            `Unknown source "${source}". Valid: ${this.pipelineService.getAvailableSources().join(', ')}`,
          );
        })();

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

  // ── NEW: ETL Management Dashboard endpoints ──────────────────────

  @ApiOperation({ summary: 'Get summary of pending raw captures by source.' })
  @ApiResponse({ status: 200, type: Object })
  @Get('pending-captures')
  async getPendingCapturesSummary() {
    const [sources, groups] = await Promise.all([
      this.prisma.source.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.rawCapture.groupBy({
        by: ['sourceId', 'status'],
        where: {
          status: { in: ['UNPROCESSED', 'FAILED'] },
          attempts: { lt: 3 },
        },
        _count: true,
      }),
    ]);

    const sourcesSummary: Record<string, { pending: number; failed: number; total: number; name: string }> = {};
    for (const src of sources) {
      sourcesSummary[src.code] = {
        pending: 0,
        failed: 0,
        total: 0,
        name: src.name,
      };
    }

    let total = 0;
    for (const group of groups) {
      const source = sources.find((s) => s.id === group.sourceId);
      if (source && sourcesSummary[source.code]) {
        const count = group._count;
        if (group.status === 'UNPROCESSED') {
          sourcesSummary[source.code].pending += count;
        } else if (group.status === 'FAILED') {
          sourcesSummary[source.code].failed += count;
        }
        sourcesSummary[source.code].total += count;
        total += count;
      }
    }

    return {
      total,
      sources: sourcesSummary,
    };
  }

  /**
   * GET /pipeline/etl-runs
   * Paginated list of ETL runs with optional filters.
   */
  @ApiOperation({ summary: 'List ETL runs with pagination and filters.' })
  @ApiResponse({ status: 200, type: EtlRunResponseDto, isArray: true })
  @Get('etl-runs')
  async listEtlRuns(
    @Query() filters: ListEtlRunsQueryDto,
  ): Promise<{ data: EtlRunResponseDto[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause from optional filters
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.from || filters.to) {
      where.startedAt = {};
      if (filters.from) where.startedAt.gte = new Date(filters.from);
      if (filters.to) where.startedAt.lte = new Date(filters.to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.etlRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.etlRun.count({ where }),
    ]);

    const data = rows.map((r) => this.toDto(r));
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /pipeline/etl-runs/:id
   * Single run detail with qualityMetric included.
   */
  @ApiOperation({ summary: 'Get a single ETL run by ID.' })
  @ApiResponse({ status: 200, type: EtlRunResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  @Get('etl-runs/:id')
  async getEtlRun(@Param('id') id: string): Promise<EtlRunResponseDto> {
    const run = await this.prisma.etlRun.findUnique({
      where: { id },
      include: { qualityMetric: true },
    });
    if (!run) {
      throw new NotFoundException(`ETL run with id "${id}" not found`);
    }
    return this.toDto(run);
  }

  /**
   * POST /pipeline/etl-runs/trigger
   * Triggers a manual ETL run. If a RUNNING run already exists, returns
   * that run's id instead of starting a new one (idempotency).
   */
  @ApiOperation({ summary: 'Trigger a manual ETL run.' })
  @ApiResponse({ status: 201, description: 'Run triggered or existing RUNNING run returned.' })
  @HttpCode(201)
  @Post('etl-runs/trigger')
  async triggerEtlRun(
    @Body() dto?: TriggerEtlRunDto,
  ): Promise<{ runId: string; status: string }> {
    // Idempotency check: if a RUNNING run exists, return it
    const existing = await this.prisma.etlRun.findFirst({
      where: { status: 'RUNNING' },
    });
    if (existing) {
      return { runId: existing.id, status: existing.status };
    }

    const action = dto?.action ?? 'full';
    const source = dto?.source ?? 'all';

    // Start a new tick asynchronously
    this.scheduler.runEtlTick({ action, source }).catch((err) => {
      this.logger.error(`Manual ETL trigger failed: ${(err as Error).message}`);
    });

    // Wait briefly for the run to be created (the tick creates it synchronously at the start)
    // Poll a few times to find the new run
    for (let i = 0; i < 10; i++) {
      const newRun = await this.prisma.etlRun.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'desc' },
      });
      if (newRun) {
        return { runId: newRun.id, status: newRun.status };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Fallback: return the latest run (should not normally reach here)
    const latest = await this.prisma.etlRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    return {
      runId: latest?.id ?? 'unknown',
      status: latest?.status ?? 'UNKNOWN',
    };
  }

  /**
   * GET /pipeline/etl-runs/:id/stream
   * SSE stream that emits progress events every 3s and a final
   * 'complete' event when the run reaches a terminal status.
   *
   * Protected by SseAuthGuard which reads JWT from ?token= query param.
   * @Public() bypasses the global JwtAuthGuard (which needs Bearer header).
   */
  @ApiOperation({ summary: 'SSE stream for ETL run progress.' })
  @Public()
  @UseGuards(SseAuthGuard)
  @Sse('etl-runs/:id/stream')
  streamEtlRun(@Param('id') id: string): Observable<MessageEvent> {
    // Validate run exists first
    const runExists = from(this.prisma.etlRun.findUnique({ where: { id } }));

    return runExists.pipe(
      switchMap((run) => {
        if (!run) {
          throw new NotFoundException(`ETL run with id "${id}" not found`);
        }

        // If already terminal, emit once and complete
        if (TERMINAL_STATUSES.includes(run.status)) {
          return of({
            data: { ...this.toDto(run), event: 'complete' },
          } as MessageEvent);
        }

        let tickCount = 0;
        // Poll every POLL_INTERVAL_MS
        return interval(POLL_INTERVAL_MS).pipe(
          // Fetch latest run state
          switchMap(() =>
            from(this.prisma.etlRun.findUnique({ where: { id } })).pipe(
              map((latest) => {
                if (!latest) {
                  return {
                    data: { event: 'error', message: 'Run not found' },
                  } as MessageEvent;
                }
                return { data: { ...this.toDto(latest), event: 'progress' } } as MessageEvent;
              }),
              catchError((err) =>
                of({
                  data: { event: 'error', message: (err as Error).message },
                } as MessageEvent),
              ),
            ),
          ),
          // Emit progress event AND heartbeat event every 5 ticks (15s)
          mergeMap((event, index) => {
            if (index > 0 && index % 5 === 0) {
              return of(
                event,
                { data: { event: 'heartbeat', ts: Date.now() } } as MessageEvent
              );
            }
            return of(event);
          }),
          // Stop when terminal or error
          takeWhile((event) => {
            const d = event.data as Record<string, unknown>;
            if (d['event'] === 'error' || d['event'] === 'complete') return false;
            if (d['status'] && TERMINAL_STATUSES.includes(d['status'] as string)) return false;
            tickCount++;
            return tickCount < 120; // max 6 minutes safety
          }, true),
        );
      }),
      catchError((err) => {
        if (err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error(`SSE stream error for run ${id}: ${(err as Error).message}`);
        return of({
          data: { event: 'error', message: 'Stream error occurred' },
        } as MessageEvent);
      }),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Maps a Prisma EtlRun row to the DTO shape including computed durationMs. */
  private toDto(run: {
    id: string;
    source: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    rowsScraped: number;
    rowsPersisted: number;
    errorSummary: string | null;
  }): EtlRunResponseDto {
    const durationMs =
      run.startedAt && run.finishedAt
        ? run.finishedAt.getTime() - run.startedAt.getTime()
        : null;

    return {
      id: run.id,
      source: run.source,
      status: run.status as any,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      rowsScraped: run.rowsScraped,
      rowsPersisted: run.rowsPersisted,
      durationMs,
      errorSummary: run.errorSummary,
    };
  }
}
