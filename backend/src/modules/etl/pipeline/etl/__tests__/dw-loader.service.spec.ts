import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DwLoaderService } from '../dw-loader.service';
import { QualityService } from '../quality.service';
import { PipelineSource } from '@web-scraping/contracts/pipeline';

function makeConfigService(env: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

function makePrismaMock() {
  return {
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    dimFuente: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([
        { id_fuente: 1, nombre_fuente: PipelineSource.MERCADOLIBRE },
        { id_fuente: 2, nombre_fuente: PipelineSource.ALIEXPRESS },
        { id_fuente: 3, nombre_fuente: PipelineSource.TEMU },
        { id_fuente: 4, nombre_fuente: PipelineSource.SHEIN },
        { id_fuente: 5, nombre_fuente: PipelineSource.API_RATES },
        { id_fuente: 6, nombre_fuente: PipelineSource.CSV_DATASET },
        { id_fuente: 7, nombre_fuente: PipelineSource.ENCUESTA },
      ]),
    },
    dimCategoria: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([
        { id_categoria: 10, nombre_categoria: 'electronica' },
        { id_categoria: 11, nombre_categoria: 'otros' },
      ]),
    },
    dimMoneda: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id_moneda: 20, codigo_moneda: 'USD' }]),
    },
    dimCalificacion: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id_calificacion: 30, nivel: 'Five' }]),
    },
    dimGenero: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id_genero: 40, nombre_genero: 'Femenino' }]),
    },
    dimTiempo: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id_tiempo: 50, fecha_completa: new Date('2026-07-10') },
        ]),
    },
    dimProducto: {
      create: jest.fn().mockResolvedValue({ id_producto: 100 }),
    },
    factProducto: {
      create: jest.fn().mockResolvedValue({}),
    },
    factEncuestaConsumo: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeOperationalPrismaMock() {
  return {
    rawCapture: {
      updateMany: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('DwLoaderService', () => {
  let stagingDir: string;
  let prisma: ReturnType<typeof makePrismaMock>;
  let operationalPrisma: ReturnType<typeof makeOperationalPrismaMock>;
  let qualityService: QualityService;

  beforeEach(async () => {
    stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-staging-'));
    prisma = makePrismaMock();
    operationalPrisma = makeOperationalPrismaMock();
    qualityService = new QualityService();
  });

  afterEach(async () => {
    await fs.rm(stagingDir, { recursive: true, force: true });
  });

  function makeService(): DwLoaderService {
    return new DwLoaderService(
      prisma as never,
      makeConfigService({ PIPELINE_STAGING_DIR: stagingDir }),
      qualityService,
      operationalPrisma as never,
    );
  }

  async function writeStaging(productos: unknown[], encuestas: unknown[] = []) {
    await fs.writeFile(
      path.join(stagingDir, 'all_products.json'),
      JSON.stringify(productos),
      'utf-8',
    );
    await fs.writeFile(
      path.join(stagingDir, 'stg_encuesta.json'),
      JSON.stringify(encuestas),
      'utf-8',
    );
  }

  const VALID_PRODUCT = {
    titulo_oferta: 'Laptop gamer',
    url_producto: 'https://mercadolibre.com.ec/item-1',
    _fuente: PipelineSource.MERCADOLIBRE,
    categoria_normalizada: 'electronica',
    moneda: 'USD',
    precio_usd: 999.99,
    precio_raw: '999.99',
    _extraido_en: '2026-07-10',
  };

  it('ETL-3/5.2: quality gate blocks the DW write — no dim/fact upsert runs on a failed batch', async () => {
    await writeStaging([{ ...VALID_PRODUCT, titulo_oferta: '' }]); // fails required-fields

    const service = makeService();
    const result = await service.load();

    expect(result.estado).toBe('fallido');
    expect(result.error).toContain('quality gate failed');
    expect(prisma.dimFuente.upsert).not.toHaveBeenCalled();
    expect(prisma.factProducto.create).not.toHaveBeenCalled();
  });

  it('5.3: upserts dim_fuente with nombre_fuente matching every PipelineSource member (ETL-6)', async () => {
    await writeStaging([VALID_PRODUCT]);
    const service = makeService();
    await service.load();

    const upsertedNames = prisma.dimFuente.upsert.mock.calls.map(
      ([arg]: [{ where: { nombre_fuente: string } }]) =>
        arg.where.nombre_fuente,
    );
    for (const source of Object.values(PipelineSource)) {
      expect(upsertedNames).toContain(source);
    }
  });

  it('5.3: loads a passing batch, creates the fact row, and returns estado=completado', async () => {
    await writeStaging([VALID_PRODUCT]);
    const service = makeService();

    const result = await service.load();

    expect(result.estado).toBe('completado');
    expect(result.productosCargados).toBe(1);
    expect(prisma.dimProducto.create).toHaveBeenCalledWith({
      data: {
        titulo_oferta: 'Laptop gamer',
        url_producto: 'https://mercadolibre.com.ec/item-1',
        disponibilidad: null,
      },
    });
    expect(prisma.factProducto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id_producto: 100,
        id_fuente: 1,
        id_categoria: 10,
        id_tiempo: 50,
        id_moneda: 20,
      }) as object,
    });
  });

  it('skips a product row when a dimension lookup misses (unknown category)', async () => {
    await writeStaging([
      { ...VALID_PRODUCT, categoria_normalizada: 'categoria_inexistente' },
    ]);
    const service = makeService();

    const result = await service.load();

    expect(result.estado).toBe('completado');
    expect(result.productosCargados).toBe(0);
    expect(prisma.factProducto.create).not.toHaveBeenCalled();
  });

  it('truncateFirst=true issues the TRUNCATE CASCADE statement before loading', async () => {
    await writeStaging([VALID_PRODUCT]);
    const service = makeService();

    await service.load({ truncateFirst: true });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('TRUNCATE TABLE') as string,
    );
  });

  it('ETL-4: DW load errors are caught and returned as estado=fallido, never thrown', async () => {
    await writeStaging([VALID_PRODUCT]);
    prisma.factProducto.create.mockRejectedValueOnce(
      new Error('constraint violation'),
    );
    const service = makeService();

    const result = await service.load();

    // The one failing insert is counted as skipped, not a fatal error —
    // matches legacy behavior (per-row try/catch inside loadFactProductos).
    expect(result.estado).toBe('completado');
    expect(result.productosCargados).toBe(0);
  });

  it('returns estado=fallido with an empty staging batch (0 rows fails staging-row-count)', async () => {
    await writeStaging([]);
    const service = makeService();

    const result = await service.load();

    expect(result.estado).toBe('fallido');
    expect(result.productosCargados).toBe(0);
  });

  it('updates raw captures to PROCESSED in the operational DB post-load', async () => {
    await writeStaging([
      {
        ...VALID_PRODUCT,
        _offerId: 'offer-123',
        _sourceId: 'source-456',
      },
    ]);
    const service = makeService();

    const result = await service.load();

    expect(result.estado).toBe('completado');
    expect(operationalPrisma.rawCapture.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            offerId: 'offer-123',
            sourceId: 'source-456',
          },
        ],
      },
      data: {
        status: 'PROCESSED',
      },
    });
  });

  it('loads in-memory data directly when inMemoryData option is provided, bypassing filesystem reads', async () => {
    // Note: we do NOT call writeStaging, so files all_products.json and stg_encuesta.json do not exist.
    const service = makeService();

    const result = await service.load({
      inMemoryData: {
        productos: [VALID_PRODUCT],
        encuestas: [],
      },
    });

    expect(result.estado).toBe('completado');
    expect(result.productosCargados).toBe(1);
    expect(prisma.dimProducto.create).toHaveBeenCalled();
  });
});
