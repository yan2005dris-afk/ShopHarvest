import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { StagingProcessorService } from '../staging-processor.service';
import { PipelineSource } from '@web-scraping/contracts/pipeline';

function makeConfigService(env: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

async function writeRaw(
  rawDir: string,
  source: string,
  records: unknown[],
): Promise<void> {
  const dir = path.join(rawDir, source);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${source}_2026-07-10T12-00-00-000Z.json`),
    JSON.stringify(records),
    'utf-8',
  );
}

describe('StagingProcessorService', () => {
  let rawDir: string;
  let stagingDir: string;
  let service: StagingProcessorService;
  let prismaMock: any;

  beforeEach(async () => {
    rawDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-raw-'));
    stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-out-'));

    prismaMock = {
      rawCapture: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    service = new StagingProcessorService(
      makeConfigService({
        PIPELINE_RAW_DIR: rawDir,
        PIPELINE_STAGING_DIR: stagingDir,
      }),
      prismaMock as any,
    );
  });

  afterEach(async () => {
    await fs.rm(rawDir, { recursive: true, force: true });
    await fs.rm(stagingDir, { recursive: true, force: true });
  });

  it('ETL-1: normalizes, converts currency, classifies, dedupes, and writes staging files', async () => {
    // Mock the operational database call to return the raw captures instead of reading files
    prismaMock.rawCapture.findMany.mockResolvedValue([
      {
        offerId: 'offer-meli-1',
        sourceId: 'source-meli',
        status: 'UNPROCESSED',
        attempts: 0,
        payload: {
          titulo: 'Laptop gamer 15 pulgadas',
          precio: '$999.99',
          moneda: 'USD',
          url_producto: 'https://mercadolibre.com.ec/item-1',
          _extraido_en: '2026-07-10T12:00:00.000Z',
        },
        source: {
          id: 'source-meli',
          code: 'mercadolibre',
          name: 'MercadoLibre Ecuador',
        },
      },
      // Exact duplicate (same titulo+precio+fuente) — must be deduped.
      {
        offerId: 'offer-meli-2',
        sourceId: 'source-meli',
        status: 'UNPROCESSED',
        attempts: 0,
        payload: {
          titulo: 'Laptop gamer 15 pulgadas',
          precio: '$999.99',
          moneda: 'USD',
          url_producto: 'https://mercadolibre.com.ec/item-1',
          _extraido_en: '2026-07-10T12:00:00.000Z',
        },
        source: {
          id: 'source-meli',
          code: 'mercadolibre',
          name: 'MercadoLibre Ecuador',
        },
      },
      {
        offerId: 'offer-ali-1',
        sourceId: 'source-ali',
        status: 'UNPROCESSED',
        attempts: 0,
        payload: {
          titulo: 'Vestido de verano',
          precio: '25.50',
          moneda: 'USD',
          url_producto: 'https://aliexpress.com/item-2',
          _extraido_en: '2026-07-10T12:00:00.000Z',
        },
        source: {
          id: 'source-ali',
          code: 'aliexpress',
          name: 'AliExpress',
        },
      },
    ]);

    const result = await service.run({
      inputDir: rawDir,
      outputDir: stagingDir,
    });

    expect(result.totalProductos).toBe(2); // 3 raw captures -> 1 dup removed
    expect(result.totalEncuestas).toBe(0);

    const staged = JSON.parse(
      await fs.readFile(path.join(stagingDir, 'all_products.json'), 'utf-8'),
    ) as Array<Record<string, unknown>>;
    expect(staged).toHaveLength(2);

    const laptop = staged.find(
      (r) => r['_fuente'] === PipelineSource.MERCADOLIBRE,
    );
    expect(laptop).toMatchObject({
      titulo_oferta: 'Laptop gamer 15 pulgadas',
      precio_raw: '$999.99',
      precio_usd: 999.99,
      categoria_normalizada: 'electronica',
      _extraido_en: '2026-07-10',
      _offerId: 'offer-meli-1',
      _sourceId: 'source-meli',
    });

    const dress = staged.find(
      (r) => r['_fuente'] === PipelineSource.ALIEXPRESS,
    );
    expect(dress).toMatchObject({
      titulo_oferta: 'Vestido de verano',
      categoria_normalizada: 'ropa',
      _offerId: 'offer-ali-1',
      _sourceId: 'source-ali',
    });
  });

  it('processes encuesta rows and dedupes them independently from products', async () => {
    // Encuestas are still file-based
    await writeRaw(rawDir, PipelineSource.ENCUESTA, [
      {
        edad: '25',
        genero: 'Femenino',
        frecuencia_compra: 'mensual',
        sitio_preferido: 'Temu',
        gasto_promedio_mensual: '50',
      },
      {
        edad: '25',
        genero: 'Femenino',
        frecuencia_compra: 'mensual',
        sitio_preferido: 'Temu',
        gasto_promedio_mensual: '50',
      },
      {
        edad: '30',
        genero: 'Masculino',
        frecuencia_compra: 'semanal',
        sitio_preferido: 'Shein',
        gasto_promedio_mensual: '80',
      },
    ]);

    prismaMock.rawCapture.findMany.mockResolvedValue([]);

    const result = await service.run({
      inputDir: rawDir,
      outputDir: stagingDir,
    });

    expect(result.totalEncuestas).toBe(2);
    const staged = JSON.parse(
      await fs.readFile(path.join(stagingDir, 'stg_encuesta.json'), 'utf-8'),
    ) as Array<Record<string, unknown>>;
    expect(staged).toHaveLength(2);
    expect(staged.every((r) => r['_fuente'] === PipelineSource.ENCUESTA)).toBe(
      true,
    );
  });

  it('drops a record and marks status as FAILED in operational database when a transform throws', async () => {
    prismaMock.rawCapture.findMany.mockResolvedValue([
      {
        offerId: 'offer-fail',
        sourceId: 'source-meli',
        status: 'UNPROCESSED',
        attempts: 0,
        payload: {
          titulo: 'Producto malo',
          precio: '10',
          moneda: 'USD',
          url_producto: 'https://x/1',
        },
        source: {
          id: 'source-meli',
          code: 'mercadolibre',
        },
      },
      {
        offerId: 'offer-ok',
        sourceId: 'source-meli',
        status: 'UNPROCESSED',
        attempts: 0,
        payload: {
          titulo: 'Producto bueno',
          precio: '10',
          moneda: 'USD',
          url_producto: 'https://x/2',
          _extraido_en: '2026-07-10T12:00:00.000Z',
        },
        source: {
          id: 'source-meli',
          code: 'mercadolibre',
        },
      },
    ]);

    // Force transformProduct to throw on the first call
    let callCount = 0;
    jest.spyOn(service as any, 'transformProduct').mockImplementation((record: any) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Forced transform error');
      }
      // Standard minimal transformation for the second one
      return {
        titulo_oferta: record.titulo,
        precio_raw: record.precio,
        precio_usd: 10,
        url_producto: record.url_producto ?? 'https://x/2',
        categoria_normalizada: 'otros',
        _extraido_en: '2026-07-10',
        _fuente: 'mercadolibre',
      };
    });

    const result = await service.run({
      inputDir: rawDir,
      outputDir: stagingDir,
    });

    expect(result.totalProductos).toBe(1); // the failed one is skipped, the other succeeds
    expect(prismaMock.rawCapture.update).toHaveBeenCalledWith({
      where: {
        offerId_sourceId: {
          offerId: 'offer-fail',
          sourceId: 'source-meli',
        },
      },
      data: {
        status: 'FAILED',
        attempts: {
          increment: 1,
        },
      },
    });
  });
});
