import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { ScrapeResult } from '../interfaces';
import { RawScraperIngestForwarder } from './raw-scraper-ingest.forwarder';
import { IngestProductsUseCase } from '../../../operational/products/application/ingest-products.use-case';
import { OperationalPrismaService } from '../../../../common/prisma/operational-prisma.service';

/**
 * RED-first specs for RawScraperIngestForwarder.
 *
 * The forwarder is the bridge that turns a headless-scrape JSON dump on
 * disk back into the operational Product flow. We exercise it against a
 * real temp dir (mkdtemp) so the file I/O path is covered without any DB
 * or network. IngestProductsUseCase and OperationalPrismaService are
 * mocked; only the forwarder's own read/map/forward logic runs.
 */
describe('RawScraperIngestForwarder', () => {
  let forwarder: RawScraperIngestForwarder;
  let ingestUseCase: jest.Mocked<IngestProductsUseCase>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    ingestUseCase = {
      execute: jest
        .fn()
        .mockResolvedValue({ ingested: 0, domainRuleId: 'rule#1' }),
    } as unknown as jest.Mocked<IngestProductsUseCase>;

    const operationalPrisma = {} as OperationalPrismaService;

    forwarder = new RawScraperIngestForwarder(ingestUseCase, operationalPrisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeResult(overrides: Partial<ScrapeResult> = {}): ScrapeResult {
    return {
      source: PipelineSource.MERCADOLIBRE,
      totalScraped: 0,
      outputPath: '',
      durationMs: 0,
      errors: [],
      ...overrides,
    };
  }

  async function writeDump(tmpDir: string, data: unknown): Promise<string> {
    const file = path.join(tmpDir, `raw_${Date.now()}_${Math.random()}.json`);
    await fs.writeFile(file, JSON.stringify(data), 'utf-8');
    return file;
  }

  async function withTmpDir<T>(fn: (tmpDir: string) => Promise<T>): Promise<T> {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'forwarder-'));
    try {
      return await fn(tmp);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }

  it('skips when totalScraped is 0 (execute not called)', async () => {
    await withTmpDir(async (tmp) => {
      const file = await writeDump(tmp, [{ titulo: 'A', precio: '10' }]);
      await forwarder.forwardIfProducible(
        makeResult({ totalScraped: 0, outputPath: file }),
      );
      expect(ingestUseCase.execute).not.toHaveBeenCalled();
    });
  });

  it('skips when outputPath is missing/empty (execute not called)', async () => {
    await forwarder.forwardIfProducible(
      makeResult({ totalScraped: 3, outputPath: '' }),
    );
    expect(ingestUseCase.execute).not.toHaveBeenCalled();
  });

  it('warns and skips when the output file does not exist', async () => {
    await forwarder.forwardIfProducible(
      makeResult({
        totalScraped: 3,
        outputPath: path.join(os.tmpdir(), 'does-not-exist-forwarder.json'),
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outputPath'));
    expect(ingestUseCase.execute).not.toHaveBeenCalled();
  });

  it('reads a JSON array file and forwards it with domain=same source and products preserved', async () => {
    await withTmpDir(async (tmp) => {
      const items = [
        { titulo: 'Laptop', precio: '799.99', moneda: 'USD' },
        { titulo: 'Mouse', precio: '12.5', moneda: 'USD' },
      ];
      const file = await writeDump(tmp, items);

      await forwarder.forwardIfProducible(
        makeResult({ totalScraped: 2, outputPath: file }),
      );

      expect(ingestUseCase.execute).toHaveBeenCalledTimes(1);
      const dto = ingestUseCase.execute.mock.calls[0][0];
      expect(dto.domain).toBe(PipelineSource.MERCADOLIBRE);
      expect(dto.pageUrl).toBeUndefined();
      expect(dto.fieldMappings).toBeUndefined();
      expect(dto.products).toHaveLength(2);
      expect(dto.products[0]).toEqual({
        titulo: 'Laptop',
        precio: '799.99',
        moneda: 'USD',
      });
      expect(dto.products[1]).toEqual({
        titulo: 'Mouse',
        precio: '12.5',
        moneda: 'USD',
      });
    });
  });

  it('warns and skips when the dump is not a JSON array', async () => {
    await withTmpDir(async (tmp) => {
      const file = await writeDump(tmp, { not: 'an array' });
      await forwarder.forwardIfProducible(
        makeResult({ totalScraped: 1, outputPath: file }),
      );
      expect(ingestUseCase.execute).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it('does not throw when execute rejects (failure containment)', async () => {
    await withTmpDir(async (tmp) => {
      const file = await writeDump(tmp, [{ titulo: 'A', precio: '10' }]);
      (ingestUseCase.execute as jest.Mock).mockRejectedValueOnce(
        new Error('db gone'),
      );
      await expect(
        forwarder.forwardIfProducible(
          makeResult({ totalScraped: 1, outputPath: file }),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
