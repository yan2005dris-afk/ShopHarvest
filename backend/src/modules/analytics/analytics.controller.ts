import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  HttpCode,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  AllKpisResponseDto,
  DwSummaryResponseDto,
  LoadDwDto,
  TimeSeriesByQuarterResponseDto,
  PreguntaPrincipalRowDto,
  RankedProductRowDto,
  CategoryDistributionRowDto,
  PercentileRowDto,
  OutlierRowDto,
  EncuestaRowDto,
} from '@web-scraping/contracts/analytics';
import { Public } from '../auth/public.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { DwLoaderService } from './dw-loader.service';

/**
 * AnalyticsController — read-only BI surface.
 *
 * 12 endpoints under `/api/analytics/*`. ALL marked `@Public()` because
 * the dashboard is required to be reachable without a JWT (PLAN §2.3
 * decision row 1). Mutations (load + refresh-mv) are also `@Public()`
 * for now — they expose no PII, the loader writes to the `dw` schema
 * which is segregated from `public.*`, and the refresh endpoint only
 * re-aggregates a materialized view.
 *
 * Pipe: each handler returns a JSON-serializable object directly.
 * BigInt/Decimal coercion happens in the service layer
 * (`dto/serializers.ts`), so the controller never sees those types.
 */
@ApiTags('Analytics')
@Controller('analytics')
@Public()
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly queryService: AnalyticsQueryService,
    private readonly dwLoader: DwLoaderService,
  ) {}

  // ─── KPIs ───────────────────────────────────────────────────

  @ApiOperation({
    summary:
      'Return all five KPI views (precio-categoria, distribucion-fuentes, completitud, rango-precios, preferencia) in a single round-trip.',
  })
  @ApiResponse({ status: 200, type: AllKpisResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @Get('kpis')
  async getAllKpis(): Promise<AllKpisResponseDto> {
    return this.analyticsService.getAllKpis();
  }

  @ApiOperation({ summary: 'Return one KPI view by URL slug.' })
  @ApiResponse({ status: 200, type: Object, isArray: true })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Unknown KPI name.' })
  @Get('kpis/:name')
  async getKpi(@Param('name') name: string): Promise<unknown[]> {
    return this.analyticsService.getKpi(name);
  }

  // ─── Analytical queries ─────────────────────────────────────

  @ApiOperation({
    summary: 'Pregunta principal: comportamiento de precios por fuente × categoría (E4 §1.1).',
  })
  @ApiResponse({ status: 200, type: PreguntaPrincipalRowDto, isArray: true })
  @Get('queries/main')
  async runPreguntaPrincipal(): Promise<PreguntaPrincipalRowDto[]> {
    return this.queryService.runPreguntaPrincipal();
  }

  @ApiOperation({
    summary: 'Ranked products: MÁS ECONÓMICO + MÁS COSTOSO por fuente (E4 §1.2).',
  })
  @ApiResponse({ status: 200, type: RankedProductRowDto, isArray: true })
  @Get('queries/ranked-products')
  async runRankedProducts(): Promise<RankedProductRowDto[]> {
    return this.queryService.runRankedProducts();
  }

  @ApiOperation({
    summary: 'Distribución por categoría (DENSE_RANK) — heatmap fuente × categoría (E4 §1.3).',
  })
  @ApiResponse({ status: 200, type: CategoryDistributionRowDto, isArray: true })
  @Get('queries/category-distribution')
  async runCategoryDistribution(): Promise<CategoryDistributionRowDto[]> {
    return this.queryService.runCategoryDistribution();
  }

  @ApiOperation({
    summary: 'Percentiles p25/p50/p75/p90 de precio por fuente (E4 §2.1).',
  })
  @ApiResponse({ status: 200, type: PercentileRowDto, isArray: true })
  @Get('queries/percentiles')
  async runPercentiles(): Promise<PercentileRowDto[]> {
    return this.queryService.runPercentileAnalysis();
  }

  @ApiOperation({
    summary: 'Detección de outliers por IQR (E4 §2.2).',
  })
  @ApiResponse({ status: 200, type: OutlierRowDto, isArray: true })
  @Get('queries/outliers')
  async runOutliers(): Promise<OutlierRowDto[]> {
    return this.queryService.runOutlierDetection();
  }

  @ApiOperation({
    summary: 'Encuesta de consumo: género × sitio preferido × frecuencia (E4 §1.4).',
  })
  @ApiResponse({ status: 200, type: EncuestaRowDto, isArray: true })
  @Get('queries/encuesta')
  async runEncuesta(): Promise<EncuestaRowDto[]> {
    return this.queryService.runEncuestaAnalysis();
  }

  @ApiOperation({
    summary:
      'Serie temporal limitada: precio promedio/min/max por trimestre × fuente, con snapshot banner (DimTiempo).',
  })
  @ApiResponse({ status: 200, type: TimeSeriesByQuarterResponseDto })
  @Get('queries/time-series')
  async runTimeSeries(): Promise<TimeSeriesByQuarterResponseDto> {
    return this.queryService.runTimeSeriesByQuarter();
  }

  // ─── Summary + maintenance ──────────────────────────────────

  @ApiOperation({
    summary:
      'Conteos por tabla (9) + snapshot banner (MIN/MAX fecha_completa en dw.dim_tiempo).',
  })
  @ApiResponse({ status: 200, type: DwSummaryResponseDto })
  @Get('summary')
  async getSummary(): Promise<DwSummaryResponseDto> {
    return this.queryService.runDwSummary();
  }

  @ApiOperation({
    summary:
      'Refresca la vista materializada dw.mv_resumen_precios (CONCURRENTLY si está disponible).',
  })
  @ApiResponse({ status: 200, type: Object })
  @HttpCode(200)
  @Post('refresh-mv')
  async refreshMv(): Promise<{ refreshed: true; view: string; ms: number }> {
    return this.queryService.refreshMaterializedView();
  }

  @ApiOperation({
    summary:
      'Carga el DW desde backend/pipeline/staging/*.json (replica del script CLI dw_load_staging.ts).',
  })
  @ApiResponse({ status: 201, type: Object })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @Post('load')
  async load(
    @Body() dto: LoadDwDto,
  ): Promise<
    | { productos_cargados: number; encuestas_cargadas: number; estado: 'completado'; tiempo_ms: number }
    | { error: string; estado: 'fallido' }
  > {
    return this.dwLoader.run({ truncate_first: dto.truncate_first ?? false });
  }
}