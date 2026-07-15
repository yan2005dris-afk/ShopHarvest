import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPrismaService } from '../../../common/prisma/analytics-prisma.service';
import {
  serializeKpiRows,
  serializeKpiRow,
  serializeValue,
} from './dto/serializers';

/**
 * RED-first spec for AnalyticsService.
 *
 * Two surface areas:
 *   1. getAllKpis()  → fans out 5 raw queries in parallel.
 *   2. getKpi(name)  → whitelist + per-KPI single fetch + NotFoundException.
 *
 * The AnalyticsPrismaService is mocked with a `$queryRawUnsafe` stub that returns
 * canned rows. We assert:
 *   - The five expected SQL statements are passed through verbatim.
 *   - BigInt counts and Decimal prices are coerced to JS numbers on the wire.
 *   - Unknown KPI names raise NotFoundException with a useful message.
 */
describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let queryRawUnsafeMock: jest.Mock;
  let executeRawUnsafeMock: jest.Mock;

  // ── Sample data shaped like the dw.v_kpi_* view outputs ─────
  // Counts come back as BigInt, NUMERIC(2) columns as Prisma.Decimal
  // strings that we treat as Decimal-like in production.
  const precioCategoriaRows = [
    {
      categoria: 'electronica',
      total_productos: 42n,
      precio_promedio_usd: { toString: () => '49.97' },
      precio_minimo: { toString: () => '1.50' },
      precio_maximo: { toString: () => '199.99' },
      display_kpi: '$49.97',
    },
  ];
  const distribucionRows = [
    {
      fuente: 'mercadolibre',
      tipo: 'scraping',
      total_productos: 58n,
      pct_contribucion: { toString: () => '33.1' },
    },
  ];
  const completitudRows = [
    {
      kpi: 'Completitud general',
      pct_precio_completo: { toString: () => '96.4' },
      pct_categoria_asignada: { toString: () => '100.0' },
      pct_calificacion_presente: { toString: () => '33.3' },
      pct_ficha_completa: { toString: () => '96.4' },
    },
  ];
  const rangoRows = [
    {
      fuente: 'aliexpress',
      n: 55n,
      precio_min: { toString: () => '1.99' },
      precio_max: { toString: () => '499.99' },
      rango_total: { toString: () => '498.00' },
      indice_diversidad_gama: { toString: () => '4.13' },
    },
  ];
  const preferenciaRows = [
    {
      plataforma: 'mercadolibre',
      votos: 11n,
      pct_preferencia: { toString: () => '45.8' },
      edad_promedio_usuario: { toString: () => '24.5' },
      frecuencias_asociadas: 'Semanal, Mensual',
    },
  ];

  const snapshotRows = [
    {
      fecha_min: new Date('2026-06-30T00:00:00.000Z'),
      fecha_max: new Date('2026-06-30T00:00:00.000Z'),
      fechas_distintas: 1n,
    },
  ];
  const countsRows = [
    { tabla: 'fact_productos', registros: 164n },
    { tabla: 'dim_fuente', registros: 5n },
  ];

  beforeEach(async () => {
    queryRawUnsafeMock = jest.fn();
    executeRawUnsafeMock = jest.fn();

    // The queryRawUnsafe mock returns the matching canned row set
    // based on substring match against the SQL. We do this instead of
    // inspecting the SQL literally to keep the spec resilient to
    // comment/whitespace edits inside the SQL string.
    queryRawUnsafeMock.mockImplementation(async (sql: string) => {
      if (sql.includes('v_kpi_precio_promedio_categoria'))
        return precioCategoriaRows;
      if (sql.includes('v_kpi_distribucion_fuentes')) return distribucionRows;
      if (sql.includes('v_kpi_completitud_datos')) return completitudRows;
      if (sql.includes('v_kpi_rango_precios_fuente')) return rangoRows;
      if (sql.includes('v_kpi_preferencia_plataformas')) return preferenciaRows;
      if (sql.includes('MIN(fecha_completa)')) return snapshotRows;
      if (sql.includes('UNION ALL SELECT')) return countsRows;
      return [];
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsPrismaService,
          useValue: {
            $queryRawUnsafe: queryRawUnsafeMock,
            $executeRawUnsafe: executeRawUnsafeMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AnalyticsService);
  });

  describe('getAllKpis', () => {
    it('queries the five KPI views in parallel via $queryRawUnsafe', async () => {
      const result = await service.getAllKpis();

      expect(queryRawUnsafeMock).toHaveBeenCalledTimes(5);
      // Every $queryRawUnsafe call must target one of the dw.v_kpi_* views.
      const calledSqls = queryRawUnsafeMock.mock.calls.map((c) => String(c[0]));
      expect(
        calledSqls.some((s) => s.includes('v_kpi_precio_promedio_categoria')),
      ).toBe(true);
      expect(
        calledSqls.some((s) => s.includes('v_kpi_distribucion_fuentes')),
      ).toBe(true);
      expect(
        calledSqls.some((s) => s.includes('v_kpi_completitud_datos')),
      ).toBe(true);
      expect(
        calledSqls.some((s) => s.includes('v_kpi_rango_precios_fuente')),
      ).toBe(true);
      expect(
        calledSqls.some((s) => s.includes('v_kpi_preferencia_plataformas')),
      ).toBe(true);

      expect(result.precio_categoria).toHaveLength(1);
      expect(result.distribucion_fuentes).toHaveLength(1);
      expect(result.completitud).toHaveLength(1);
      expect(result.rango_precios).toHaveLength(1);
      expect(result.preferencia).toHaveLength(1);
    });

    it('coerces BigInt counts and Decimal prices to JS numbers on the wire', async () => {
      const result = await service.getAllKpis();
      const row = result.precio_categoria[0] as unknown as Record<
        string,
        unknown
      >;
      expect(typeof row['total_productos']).toBe('number');
      expect(row['total_productos']).toBe(42);
      expect(typeof row['precio_promedio_usd']).toBe('number');
      expect(row['precio_promedio_usd']).toBe(49.97);
      expect(typeof row['precio_minimo']).toBe('number');
      expect(row['precio_minimo']).toBe(1.5);
      expect(typeof row['precio_maximo']).toBe('number');
      expect(row['precio_maximo']).toBeCloseTo(199.99, 2);

      const dist = result.distribucion_fuentes[0] as unknown as Record<
        string,
        unknown
      >;
      expect(typeof dist['total_productos']).toBe('number');
      expect(dist['pct_contribucion']).toBe(33.1);

      const rango = result.rango_precios[0] as unknown as Record<
        string,
        unknown
      >;
      expect(typeof rango['n']).toBe('number');
      expect(rango['rango_total']).toBe(498);
    });
  });

  describe('getKpi', () => {
    it('returns rows for a known KPI name', async () => {
      const rows = await service.getKpi('precio-categoria');
      expect(rows).toHaveLength(1);
      // Coercion still happens through serializeKpiRows.
      expect(
        typeof (rows[0] as Record<string, unknown>)['total_productos'],
      ).toBe('number');
    });

    it('throws NotFoundException for an unknown KPI name', async () => {
      await expect(service.getKpi('not-a-kpi')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lists all five valid KPI names in the NotFoundException message', async () => {
      try {
        await service.getKpi('not-a-kpi');
        fail('expected NotFoundException');
      } catch (err) {
        const message = (err as NotFoundException).message;
        expect(message).toContain('precio-categoria');
        expect(message).toContain('distribucion-fuentes');
        expect(message).toContain('completitud');
        expect(message).toContain('rango-precios');
        expect(message).toContain('preferencia');
      }
    });
  });

  describe('getSnapshot', () => {
    it('returns ISO date strings and a coerced fechas_distintas count', async () => {
      const snap = await service.getSnapshot();
      expect(snap.fecha_min).toBe('2026-06-30');
      expect(snap.fecha_max).toBe('2026-06-30');
      expect(snap.fechas_distintas).toBe(1);
    });

    it('handles an empty dw.dim_tiempo without throwing', async () => {
      queryRawUnsafeMock.mockImplementationOnce(async () => []);
      const snap = await service.getSnapshot();
      expect(snap.fecha_min).toBeNull();
      expect(snap.fecha_max).toBeNull();
      expect(snap.fechas_distintas).toBe(0);
    });
  });

  describe('getDwCounts', () => {
    it('maps BigInt counts to JS numbers', async () => {
      const rows = await service.getDwCounts();
      const fp = rows.find((r) => r.tabla === 'fact_productos');
      expect(fp?.registros).toBe(164);
      expect(typeof fp?.registros).toBe('number');
    });
  });
});

describe('serializers (BigInt / Decimal coercion)', () => {
  it('serializeValue coerces BigInt → Number', () => {
    expect(serializeValue(42n)).toBe(42);
  });

  it('serializeValue coerces Decimal-like → Number via toString', () => {
    expect(serializeValue({ toString: () => '49.97' })).toBe(49.97);
  });

  it('serializeValue converts Date → ISO string', () => {
    expect(serializeValue(new Date('2026-06-30T00:00:00.000Z'))).toBe(
      '2026-06-30T00:00:00.000Z',
    );
  });

  it('serializeValue recurses into arrays and nested objects', () => {
    const input = { rows: [{ n: 5n, d: { toString: () => '1.5' } }] };
    const out = serializeValue(input) as {
      rows: Array<{ n: number; d: number }>;
    };
    expect(out.rows[0].n).toBe(5);
    expect(out.rows[0].d).toBe(1.5);
  });

  it('serializeKpiRows coerces every row', () => {
    const rows = [
      { count: 1n, price: { toString: () => '9.99' } },
      { count: 2n, price: { toString: () => '19.99' } },
    ];
    const out = serializeKpiRows<{ count: number; price: number }>(rows);
    expect(out[0].count).toBe(1);
    expect(out[0].price).toBe(9.99);
    expect(out[1].price).toBe(19.99);
  });

  it('serializeKpiRow coerces a single object', () => {
    const out = serializeKpiRow<{ n: number; d: number }>({
      n: 3n,
      d: { toString: () => '2.71' },
    });
    expect(out.n).toBe(3);
    expect(out.d).toBe(2.71);
  });

  it('passes through null and primitive values', () => {
    expect(serializeValue(null)).toBeNull();
    expect(serializeValue(undefined)).toBeUndefined();
    expect(serializeValue('plain')).toBe('plain');
    expect(serializeValue(42)).toBe(42);
    expect(serializeValue(true)).toBe(true);
  });
});
