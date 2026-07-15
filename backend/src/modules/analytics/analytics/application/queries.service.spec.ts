import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { KpisService } from './kpis.service';
import { AnalyticsPrismaService } from '../../../../common/prisma/analytics-prisma.service';

/**
 * RED-first spec for QueriesService.
 *
 * Each of the 8 SQL-bearing methods is exercised against a mocked
 * `$queryRawUnsafe`. The assertions focus on:
 *   1. The expected SQL fingerprint is invoked (table + key column).
 *   2. Returned rows are BigInt/Decimal-coerced on the way out.
 *   3. The time-series method calls the snapshot helper for the banner.
 *   4. `refreshMaterializedView` falls back to the non-CONCURRENTLY
 *      variant when Postgres refuses it.
 */
describe('QueriesService', () => {
  let service: QueriesService;
  let queryRawUnsafeMock: jest.Mock;
  let executeRawUnsafeMock: jest.Mock;
  let warnSpy: jest.SpyInstance;

  /**
   * Build a fake row that mimics the dw.* output of each query.
   * BigInt counts and Decimal prices are the two shapes the serializer
   * must convert.
   */
  const fakeBigInt = (v: number) => BigInt(v);
  const fakeDecimal = (s: string): { toString(): string } => ({
    toString: () => s,
  });

  beforeEach(async () => {
    queryRawUnsafeMock = jest.fn();
    executeRawUnsafeMock = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QueriesService,
        {
          provide: KpisService,
          useValue: {
            getSnapshot: jest.fn().mockResolvedValue({
              fecha_min: '2026-06-30',
              fecha_max: '2026-06-30',
              fechas_distintas: 1,
            }),
            getDwCounts: jest.fn().mockResolvedValue([
              { tabla: 'fact_productos', registros: 164 },
              { tabla: 'fact_encuesta_consumo', registros: 24 },
            ]),
          },
        },
        {
          provide: AnalyticsPrismaService,
          useValue: {
            $queryRawUnsafe: queryRawUnsafeMock,
            $executeRawUnsafe: executeRawUnsafeMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(QueriesService);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────
  it('runPreguntaPrincipal hits dw.fact_productos and coerces rows', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        fuente: 'mercadolibre',
        categoria: 'electronica',
        total_productos: fakeBigInt(21),
        precio_promedio_usd: fakeDecimal('79.99'),
        precio_minimo_usd: fakeDecimal('12.50'),
        precio_maximo_usd: fakeDecimal('199.99'),
        mediana_precio_usd: fakeDecimal('65.40'),
        desviacion_estandar: fakeDecimal('32.10'),
      },
    ]);
    const rows = await service.runPreguntaPrincipal();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('dw.fact_productos');
    expect(sql).toContain('PERCENTILE_CONT(0.5)');
    expect(sql).toContain('STDDEV(fp.precio_usd)');
    expect(rows[0].total_productos).toBe(21);
    expect(rows[0].precio_promedio_usd).toBe(79.99);
    expect(rows[0].precio_maximo_usd).toBe(199.99);
  });

  // ─────────────────────────────────────────────────────────
  it('runRankedProducts uses the RANK() window-function pattern', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        fuente: 'aliexpress',
        producto: 'Cable barato',
        precio_usd: fakeDecimal('1.99'),
        tipo: 'MÁS ECONÓMICO',
      },
    ]);
    const rows = await service.runRankedProducts();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('RANK() OVER');
    expect(sql).toContain('PARTITION BY df.nombre_fuente');
    expect(sql).toContain('rank_economico = 1');
    expect(rows[0].precio_usd).toBe(1.99);
  });

  // ─────────────────────────────────────────────────────────
  it('runCategoryDistribution uses DENSE_RANK() and the window-function total', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        categoria: 'otros',
        total_productos: fakeBigInt(148),
        pct_del_total: fakeDecimal('88.1'),
        precio_promedio: fakeDecimal('38.42'),
        rank_frecuencia: fakeBigInt(1),
      },
    ]);
    const rows = await service.runCategoryDistribution();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('DENSE_RANK()');
    expect(sql).toContain('SUM(COUNT(fp.id_hecho)) OVER()');
    expect(rows[0].total_productos).toBe(148);
    expect(rows[0].pct_del_total).toBe(88.1);
  });

  // ─────────────────────────────────────────────────────────
  it('runPercentileAnalysis emits the four PERCENTILE_CONT calls', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        fuente: 'shein',
        total_con_precio: fakeBigInt(22),
        percentil_25: fakeDecimal('9.5'),
        mediana: fakeDecimal('18.4'),
        percentil_75: fakeDecimal('35.2'),
        percentil_90: fakeDecimal('62.0'),
        media: fakeDecimal('24.5'),
        desviacion: fakeDecimal('18.3'),
      },
    ]);
    const rows = await service.runPercentileAnalysis();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('PERCENTILE_CONT(0.25)');
    expect(sql).toContain('PERCENTILE_CONT(0.50)');
    expect(sql).toContain('PERCENTILE_CONT(0.75)');
    expect(sql).toContain('PERCENTILE_CONT(0.90)');
    expect(rows[0].mediana).toBe(18.4);
  });

  // ─────────────────────────────────────────────────────────
  it('runOutlierDetection wraps the IQR CTE and CASE-classifies each row', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        producto: 'Premium Headphones 5000',
        fuente: 'aliexpress',
        precio_usd: fakeDecimal('499.99'),
        clasificacion: 'OUTLIER SUPERIOR',
      },
    ]);
    const rows = await service.runOutlierDetection();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('WITH stats AS');
    expect(sql).toContain('OUTLIER INFERIOR');
    expect(sql).toContain('OUTLIER SUPERIOR');
    expect(rows[0].clasificacion).toBe('OUTLIER SUPERIOR');
    expect(rows[0].precio_usd).toBe(499.99);
  });

  // ─────────────────────────────────────────────────────────
  it('runEncuestaAnalysis groups by (genero, fuente, frecuencia, gasto)', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        genero: 'Femenino',
        sitio_preferido: 'mercadolibre',
        total_encuestados: fakeBigInt(5),
        frecuencia: 'Semanal',
        gasto_promedio: '$50-$100',
      },
    ]);
    const rows = await service.runEncuestaAnalysis();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('dw.fact_encuesta_consumo');
    expect(sql).toContain('dw.dim_genero');
    expect(sql).toContain('GROUP BY dg.nombre_genero');
    expect(rows[0].total_encuestados).toBe(5);
  });

  // ─────────────────────────────────────────────────────────
  it('runTimeSeriesByQuarter joins dw.dim_tiempo and dw.dim_fuente, attaches the snapshot banner', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        anio: fakeBigInt(2026),
        trimestre: fakeBigInt(2),
        nombre_mes: 'Junio',
        fuente: 'mercadolibre',
        total: fakeBigInt(58),
        precio_promedio: fakeDecimal('49.97'),
        precio_min: fakeDecimal('1.5'),
        precio_max: fakeDecimal('199.99'),
      },
    ]);
    const result = await service.runTimeSeriesByQuarter();
    const sql = String(queryRawUnsafeMock.mock.calls[0][0]);
    expect(sql).toContain('dw.dim_tiempo');
    expect(sql).toContain('dw.dim_fuente');
    expect(sql).toContain(
      'GROUP BY dt.anio, dt.trimestre, dt.nombre_mes, df.nombre_fuente',
    );
    expect(result.series[0].anio).toBe(2026);
    expect(result.series[0].precio_max).toBeCloseTo(199.99, 2);
    expect(result.snapshot.fecha_min).toBe('2026-06-30');
  });

  // ─────────────────────────────────────────────────────────
  it('refreshMaterializedView tries CONCURRENTLY then falls back', async () => {
    executeRawUnsafeMock
      .mockRejectedValueOnce(new Error('CONCURRENTLY requires a unique index'))
      .mockResolvedValueOnce(undefined);
    const result = await service.refreshMaterializedView();
    expect(executeRawUnsafeMock).toHaveBeenCalledTimes(2);
    expect(String(executeRawUnsafeMock.mock.calls[0][0])).toContain(
      'CONCURRENTLY',
    );
    expect(String(executeRawUnsafeMock.mock.calls[1][0])).not.toContain(
      'CONCURRENTLY',
    );
    expect(result.refreshed).toBe(true);
    expect(result.view).toBe('dw.mv_resumen_precios');
    expect(typeof result.ms).toBe('number');
  });
});
