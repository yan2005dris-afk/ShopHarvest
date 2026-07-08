import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DwLoaderService } from './dw-loader.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * RED-first spec for DwLoaderService.
 *
 * The service touches the filesystem to read `pipeline/staging/*.json`.
 * We don't want the spec to actually read those files (CI runs in a
 * fresh container and the staging files may be re-generated between
 * tests). Instead we:
 *   1. `jest.mock('fs')` so the imported `fs.readFileSync` becomes a
 *      spy jest can re-implement per test.
 *   2. Stub PrismaService with in-memory tracking of $queryRawUnsafe +
 *      $executeRawUnsafe so we can assert every dimension/fact INSERT
 *      is fired.
 *
 * Cover four scenarios:
 *   a. happy path   → { estado: 'completado', … } with inserted counts.
 *   b. skip-without-titulo → counts reflect the skip.
 *   c. truncate_first=true  → first call is TRUNCATE.
 *   d. fs throws    → { estado: 'fallido', error } envelope.
 *   e. Prisma throws → { estado: 'fallido', error } envelope.
 */

// Mock the fs module BEFORE importing the service so the import-time
// bindings resolve to the jest.fn() below. The factory uses a global
// registry because jest.mock factories run before the test file's
// module-level `let` bindings are initialized (TDZ trap).
const globalAny = globalThis as unknown as { __readFileSyncSpy?: jest.Mock };
globalAny.__readFileSyncSpy = jest.fn();
jest.mock(
  'fs',
  () => {
    const actual = jest.requireActual('fs') as typeof import('fs');
    return {
      ...actual,
      readFileSync: (...args: unknown[]) =>
        (globalThis as unknown as { __readFileSyncSpy?: jest.Mock })
          .__readFileSyncSpy!(...args),
    };
  },
);

const readFileSyncSpy = (): jest.Mock => {
  const spy = (globalThis as unknown as { __readFileSyncSpy?: jest.Mock })
    .__readFileSyncSpy;
  if (!spy) throw new Error('readFileSyncSpy not initialized');
  return spy;
};

describe('DwLoaderService', () => {
  let service: DwLoaderService;
  let queryRawUnsafeMock: jest.Mock;
  let executeRawUnsafeMock: jest.Mock;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const stagingProductos = [
    {
      titulo_oferta: 'Audífonos inalámbricos',
      url_producto: 'https://example.com/audifonos',
      precio_usd: 19.99,
      precio_raw: '$19.99',
      moneda: 'USD',
      disponibilidad: 'In stock',
      calificacion: 'Four',
      _fuente: 'mercadolibre',
      _categoria: 'electronica',
      _extraido_en: '2026-06-30',
    },
    {
      titulo_oferta: 'Camiseta básica',
      url_producto: 'https://example.com/camiseta',
      precio_usd: 9.5,
      precio_raw: '$9.50',
      moneda: 'USD',
      disponibilidad: null,
      calificacion: null,
      _fuente: 'shein',
      _categoria: 'moda',
      _extraido_en: '2026-06-30',
    },
  ];
  const stagingEncuesta = [
    {
      genero: 'Femenino',
      sitio_preferido: 'MercadoLibre',
      edad: 22,
      frecuencia_compra: 'Semanal',
      gasto_promedio_mensual: '$50-$100',
      motivo_compra: 'Precio',
    },
  ];

  beforeEach(async () => {
    queryRawUnsafeMock = jest.fn();
    executeRawUnsafeMock = jest.fn();

    queryRawUnsafeMock.mockImplementation(async (sql: string) => {
      const m = /id_(\w+) AS id FROM dw\.dim_(\w+)/.exec(sql);
      if (m) return [{ id: 1 }];
      if (/INSERT INTO dw\.dim_producto/.test(sql)) {
        return [{ id_producto: 100 }];
      }
      return [];
    });
    executeRawUnsafeMock.mockResolvedValue(undefined);

    // Default canned JSON. Tests can override per case.
    readFileSyncSpy().mockImplementation((p: string) => {
      if (p.includes('all_products_clean.json')) {
        return JSON.stringify(stagingProductos);
      }
      if (p.includes('stg_encuesta_clean.json')) {
        return JSON.stringify(stagingEncuesta);
      }
      throw new Error(`unexpected read of ${p}`);
    });

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DwLoaderService,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: queryRawUnsafeMock,
            $executeRawUnsafe: executeRawUnsafeMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DwLoaderService);
  });

  afterEach(() => {
    readFileSyncSpy().mockReset();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('reads both staging JSONs and inserts dimensions + facts', async () => {
    const result = await service.run();
    expect(result.estado).toBe('completado');
    if (result.estado === 'completado') {
      expect(result.productos_cargados).toBe(2);
      expect(result.encuestas_cargadas).toBe(1);
      expect(typeof result.tiempo_ms).toBe('number');
    }
    // Assert every dimension + fact got at least one INSERT.
    const executedSqls = executeRawUnsafeMock.mock.calls.map((c) => String(c[0]));
    expect(executedSqls.some((s) => s.includes('dw.dim_fuente'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.dim_categoria'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.dim_moneda'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.dim_calificacion'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.dim_genero'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.dim_tiempo'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.fact_productos'))).toBe(true);
    expect(executedSqls.some((s) => s.includes('dw.fact_encuesta_consumo'))).toBe(true);
  });

  it('skips rows missing titulo_oferta and counts them', async () => {
    readFileSyncSpy().mockImplementation((p: string) => {
      if (p.includes('all_products_clean.json')) {
        return JSON.stringify([
          { titulo_oferta: 'Válido', _fuente: 'mercadolibre', _categoria: 'moda',
            _extraido_en: '2026-06-30', precio_usd: 5 },
          { titulo_oferta: '', _fuente: 'mercadolibre' },
        ]);
      }
      return JSON.stringify(stagingEncuesta);
    });
    const result = await service.run();
    expect(result.estado).toBe('completado');
    if (result.estado === 'completado') {
      expect(result.productos_cargados).toBe(1);
    }
  });

  it('truncates facts first when truncate_first=true', async () => {
    await service.run({ truncate_first: true });
    const firstSql = String(executeRawUnsafeMock.mock.calls[0][0]);
    expect(firstSql).toMatch(/TRUNCATE/i);
    expect(firstSql).toContain('dw.fact_productos');
  });

  it('returns { estado: "fallido", error } when fs.readFileSync throws', async () => {
    readFileSyncSpy().mockImplementation(() => {
      throw new Error('EACCES staging file missing');
    });
    const result = await service.run();
    expect(result.estado).toBe('fallido');
    if (result.estado === 'fallido') {
      expect(result.error).toContain('EACCES');
    }
  });

  it('returns { estado: "fallido", error } when Prisma throws', async () => {
    executeRawUnsafeMock.mockRejectedValueOnce(new Error('connection refused'));
    const result = await service.run();
    expect(result.estado).toBe('fallido');
    if (result.estado === 'fallido') {
      expect(result.error).toContain('connection refused');
    }
  });
});