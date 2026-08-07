import { Controller, Get, Param, Post, Body, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { Public } from '../../../../operational/auth/common/public.decorator';
import { Roles } from '../../../../operational/auth/common/roles.decorator';
import { KpisService } from '../../application/kpis.service';
import { QueriesService } from '../../application/queries.service';
import { DwLoaderService } from '../../application/dw-loader.service';

/**
 * AnalyticsHttpController — read-only BI surface.
 *
 * The 10 GET endpoints are individually `@Public()` because the
 * dashboard is required to be reachable without a JWT (PLAN §2.3
 * decision row 1). The 2 mutation endpoints (`refresh-mv`, `load`)
 * are NOT public — `load` in particular accepts `truncate_first`,
 * which wipes `dw.fact_*`, and neither is ever called by the
 * dashboard frontend (confirmed: no reference in frontend/src) — they
 * require the existing JWT auth (CodeRabbit finding, PR #11).
 *
 * Pipe: each handler returns a JSON-serializable object directly.
 * BigInt/Decimal coercion happens in the service layer
 * (`dto/serializers.ts`), so the controller never sees those types.
 */
@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsHttpController {
  constructor(
    private readonly kpisService: KpisService,
    private readonly queriesService: QueriesService,
    private readonly dwLoader: DwLoaderService,
  ) {}

  // ─── KPIs ───────────────────────────────────────────────────

  @ApiOperation({
    summary:
      'Return all five KPI views (precio-categoria, distribucion-fuentes, completitud, rango-precios, preferencia) in a single round-trip.',
  })
  @ApiResponse({ status: 200, type: AllKpisResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @Public()
  @Get('kpis')
  async getAllKpis(): Promise<AllKpisResponseDto> {
    return this.kpisService.getAllKpis();
  }

  @ApiOperation({ summary: 'Return one KPI view by URL slug.' })
  @ApiResponse({ status: 200, type: Object, isArray: true })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Unknown KPI name.',
  })
  @Public()
  @Get('kpis/:name')
  async getKpi(@Param('name') name: string): Promise<unknown[]> {
    return this.kpisService.getKpi(name);
  }

  // ─── Analytical queries ─────────────────────────────────────

  @ApiOperation({
    summary:
      'Pregunta principal: comportamiento de precios por fuente × categoría (E4 §1.1).',
  })
  @ApiResponse({ status: 200, type: PreguntaPrincipalRowDto, isArray: true })
  @Public()
  @Get('queries/main')
  async runPreguntaPrincipal(): Promise<PreguntaPrincipalRowDto[]> {
    return this.queriesService.runPreguntaPrincipal();
  }

  @ApiOperation({
    summary:
      'Ranked products: MÁS ECONÓMICO + MÁS COSTOSO por fuente (E4 §1.2).',
  })
  @ApiResponse({ status: 200, type: RankedProductRowDto, isArray: true })
  @Public()
  @Get('queries/ranked-products')
  async runRankedProducts(): Promise<RankedProductRowDto[]> {
    return this.queriesService.runRankedProducts();
  }

  @ApiOperation({
    summary:
      'Distribución por categoría (DENSE_RANK) — heatmap fuente × categoría (E4 §1.3).',
  })
  @ApiResponse({ status: 200, type: CategoryDistributionRowDto, isArray: true })
  @Public()
  @Get('queries/category-distribution')
  async runCategoryDistribution(): Promise<CategoryDistributionRowDto[]> {
    return this.queriesService.runCategoryDistribution();
  }

  @ApiOperation({
    summary: 'Percentiles p25/p50/p75/p90 de precio por fuente (E4 §2.1).',
  })
  @ApiResponse({ status: 200, type: PercentileRowDto, isArray: true })
  @Public()
  @Get('queries/percentiles')
  async runPercentiles(): Promise<PercentileRowDto[]> {
    return this.queriesService.runPercentileAnalysis();
  }

  @ApiOperation({
    summary: 'Detección de outliers por IQR (E4 §2.2).',
  })
  @ApiResponse({ status: 200, type: OutlierRowDto, isArray: true })
  @Public()
  @Get('queries/outliers')
  async runOutliers(): Promise<OutlierRowDto[]> {
    return this.queriesService.runOutlierDetection();
  }

  @ApiOperation({
    summary:
      'Encuesta de consumo: género × sitio preferido × frecuencia (E4 §1.4).',
  })
  @ApiResponse({ status: 200, type: EncuestaRowDto, isArray: true })
  @Public()
  @Get('queries/encuesta')
  async runEncuesta(): Promise<EncuestaRowDto[]> {
    return this.queriesService.runEncuestaAnalysis();
  }

  @ApiOperation({
    summary:
      'Serie temporal limitada: precio promedio/min/max por trimestre × fuente, con snapshot banner (DimTiempo).',
  })
  @ApiResponse({ status: 200, type: TimeSeriesByQuarterResponseDto })
  @Public()
  @Get('queries/time-series')
  async runTimeSeries(): Promise<TimeSeriesByQuarterResponseDto> {
    return this.queriesService.runTimeSeriesByQuarter();
  }

  // ─── Summary + maintenance ──────────────────────────────────

  @ApiOperation({
    summary:
      'Conteos por tabla (9) + snapshot banner (MIN/MAX fecha_completa en dw.dim_tiempo).',
  })
  @ApiResponse({ status: 200, type: DwSummaryResponseDto })
  @Public()
  @Get('summary')
  async getSummary(): Promise<DwSummaryResponseDto> {
    return this.queriesService.runDwSummary();
  }

  @Roles('admin')
  @ApiOperation({
    summary:
      'Refresca la vista materializada dw.mv_resumen_precios (CONCURRENTLY si está disponible).',
  })
  @ApiResponse({ status: 200, type: Object })
  @HttpCode(200)
  @Post('refresh-mv')
  async refreshMv(): Promise<{ refreshed: true; view: string; ms: number }> {
    return this.queriesService.refreshMaterializedView();
  }

  @ApiOperation({
    summary:
      'Carga el DW desde backend/pipeline/staging/*.json (replica del script CLI dw_load_staging.ts).',
  })
  @Roles('admin')
  @ApiResponse({ status: 201, type: Object })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @Post('load')
  async load(@Body() dto: LoadDwDto): Promise<
    | {
        productos_cargados: number;
        encuestas_cargadas: number;
        estado: 'completado';
        tiempo_ms: number;
      }
    | { error: string; estado: 'fallido' }
  > {
    return this.dwLoader.run({ truncate_first: dto.truncate_first ?? false });
  }
}
