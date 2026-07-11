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

  beforeEach(async () => {
    rawDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-raw-'));
    stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-out-'));
    service = new StagingProcessorService(makeConfigService());
  });

  afterEach(async () => {
    await fs.rm(rawDir, { recursive: true, force: true });
    await fs.rm(stagingDir, { recursive: true, force: true });
  });

  it('ETL-1: normalizes, converts currency, classifies, dedupes, and writes staging files', async () => {
    await writeRaw(rawDir, PipelineSource.MERCADOLIBRE, [
      {
        titulo: 'Laptop gamer 15 pulgadas',
        precio: '$999.99',
        moneda: 'USD',
        url_producto: 'https://mercadolibre.com.ec/item-1',
        _extraido_en: '2026-07-10T12:00:00.000Z',
      },
      // Exact duplicate (same titulo+precio+fuente) — must be deduped.
      {
        titulo: 'Laptop gamer 15 pulgadas',
        precio: '$999.99',
        moneda: 'USD',
        url_producto: 'https://mercadolibre.com.ec/item-1',
        _extraido_en: '2026-07-10T12:00:00.000Z',
      },
    ]);
    await writeRaw(rawDir, PipelineSource.ALIEXPRESS, [
      {
        titulo: 'Vestido de verano',
        precio: '25.50',
        moneda: 'USD',
        url_producto: 'https://aliexpress.com/item-2',
        _extraido_en: '2026-07-10T12:00:00.000Z',
      },
    ]);

    const result = await service.run({
      inputDir: rawDir,
      outputDir: stagingDir,
    });

    expect(result.totalProductos).toBe(2); // 3 raw rows → 1 dup removed
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
    });

    const dress = staged.find(
      (r) => r['_fuente'] === PipelineSource.ALIEXPRESS,
    );
    expect(dress).toMatchObject({
      titulo_oferta: 'Vestido de verano',
      categoria_normalizada: 'ropa',
    });
  });

  it('processes encuesta rows and dedupes them independently from products', async () => {
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

  it('skips a source directory with no raw dumps instead of crashing', async () => {
    // Only MELI has data; ALI/Temu/Shein/CSV directories don't exist.
    await writeRaw(rawDir, PipelineSource.MERCADOLIBRE, [
      {
        titulo: 'Producto único',
        precio: '10',
        moneda: 'USD',
        url_producto: 'https://mercadolibre.com.ec/x',
        _extraido_en: '2026-07-10T12:00:00.000Z',
      },
    ]);

    const result = await service.run({
      inputDir: rawDir,
      outputDir: stagingDir,
    });
    expect(result.totalProductos).toBe(1);
  });

  it('drops a record instead of crashing the whole batch when a transform throws', async () => {
    // toUpperCase() on a non-string moneda would throw inside cleanAndConvertToUsd
    // callers — verify one bad record doesn't take down the others.
    await writeRaw(rawDir, PipelineSource.MERCADOLIBRE, [
      {
        titulo: 'Producto bueno',
        precio: '10',
        moneda: 'USD',
        url_producto: 'https://x/1',
      },
      null, // malformed entry
    ]);

    const result = await service.run({
      inputDir: rawDir,
      outputDir: stagingDir,
    });
    expect(result.totalProductos).toBeGreaterThanOrEqual(1);
  });
});
