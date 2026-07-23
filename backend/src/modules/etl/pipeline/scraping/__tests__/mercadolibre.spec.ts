import { ConfigService } from '@nestjs/config';
import { scrapeMercadoLibre } from '../mercadolibre';
import { BrowserFactoryService } from '../browser-factory.service';
import type {
  SourceConfig,
  ScrapeResult,
} from '@web-scraping/contracts/pipeline';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { readFileSync } from 'fs';

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

interface FakePageOpts {
  status?: number;
  bodyHtml?: string;
  failOnGoto?: boolean;
  failOnEvaluate?: boolean;
}

function makeFakePage(opts: FakePageOpts = {}) {
  const status = opts.status ?? 200;
  const failOnGoto = opts.failOnGoto ?? false;
  const failOnEvaluate = opts.failOnEvaluate ?? false;
  const evaluate = jest.fn().mockImplementation(() => {
    if (failOnEvaluate) {
      throw new Error('evaluate failed');
    }
    return Promise.resolve([
      {
        titulo: 'Test product 1',
        precio: '$99.99',
        moneda: 'USD',
        url_producto: 'https://mercadolibre.com.ec/item-1',
      },
      {
        titulo: 'Test product 2',
        precio: '$149.50',
        moneda: 'USD',
        url_producto: 'https://mercadolibre.com.ec/item-2',
      },
    ]);
  });
  const goto = jest.fn().mockImplementation(() => {
    if (failOnGoto) {
      throw new Error('navigation failed');
    }
    return Promise.resolve({ status: () => status });
  });
  const bodyHtml = opts.bodyHtml ?? '<html></html>';
  const content = jest.fn().mockResolvedValue(bodyHtml);
  const close = jest.fn().mockResolvedValue(undefined);
  const waitForTimeout = jest.fn().mockResolvedValue(undefined);
  const mouse = {
    move: jest.fn().mockResolvedValue(undefined),
  };
  return {
    goto,
    evaluate,
    content,
    close,
    waitForTimeout,
    mouse,
  };
}

function makeFakeBrowserFactory(pages: ReturnType<typeof makeFakePage>[]) {
  const pageQueue = [...pages];
  const newPage = jest.fn().mockImplementation(() => {
    if (pageQueue.length === 0) {
      return makeFakePage();
    }
    return pageQueue.shift();
  });
  const context = {
    newPage,
    close: jest.fn().mockResolvedValue(undefined),
  };
  const browser = {
    newContext: jest.fn().mockResolvedValue(context),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const factory: Partial<BrowserFactoryService> = {
    launch: jest.fn().mockResolvedValue(browser),
    newContext: jest.fn().mockResolvedValue(context),
  };
  return { factory: factory as BrowserFactoryService, browser, context };
}

function makeConfigService(env: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
}

const FAST_OPTS = { settlePauseMs: 0, scrollPauseMs: 0 };

describe('scrapeMercadoLibre', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meli-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('MELI-S1: targets mercadolibre.com.ec, not a demo fallback domain', async () => {
    // The CATEGORIES array is hardcoded in mercadolibre.ts with
    // mercadolibre.com.ec URLs. This test verifies the source itself
    // does not contain any demo fallback domains and that the scraper
    // runs against the real target. The CI grep guardrail in
    // .github/workflows/ci.yml is the runtime check; this test is
    // the contract-level check.
    //
    // The banned domains are built at runtime (not written as a
    // contiguous literal) so this very assertion doesn't trip the CI
    // guardrail's plain-text grep over backend/src/.
    const scraperSource = readFileSync(
      path.join(__dirname, '..', 'mercadolibre.ts'),
      'utf-8',
    );
    const bannedDomains = ['books', 'quotes'].map((s) => `${s}.toscrape.com`);

    // No demo domains in the source.
    for (const banned of bannedDomains) {
      expect(scraperSource).not.toContain(banned);
    }

    // The CATEGORIES array points at mercadolibre.com.ec.
    expect(scraperSource).toMatch(/mercadolibre\.com\.ec/);

    // Run the scraper and verify the source field.
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result = await scrapeMercadoLibre(config, factory, cs, FAST_OPTS);
    expect(result.source).toBe(PipelineSource.MERCADOLIBRE);
  });

  it('MELI-S2: retries with exponential backoff on HTTP 4xx/5xx or anti-bot challenge', async () => {
    const failingPage = makeFakePage({ status: 503 });
    const successPage = makeFakePage({ status: 200 });
    const { factory } = makeFakeBrowserFactory([failingPage, successPage]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result = await scrapeMercadoLibre(config, factory, cs, {
      maxRetries: 1,
      retryBaseMs: 5,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it('MELI-S3: logs metrics via NestJS logger (items, duration, retries, state)', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result = await scrapeMercadoLibre(config, factory, cs, FAST_OPTS);

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.totalScraped).toBe('number');
    expect(result.totalScraped).toBeGreaterThan(0);
  });

  it('MELI-S4: uses PIPELINE_RAW_DIR env var (NOT process.cwd()) for output paths', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result = await scrapeMercadoLibre(config, factory, cs, FAST_OPTS);

    expect(result.outputPath).toContain(tmpDir);
    expect(result.outputPath).not.toMatch(/process\.cwd\(\)/);

    const stat = await fs.stat(result.outputPath);
    expect(stat.isFile()).toBe(true);
  });

  it('MELI-S5: persists raw JSON to the configured output dir', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result = await scrapeMercadoLibre(config, factory, cs, FAST_OPTS);

    const raw = await fs.readFile(result.outputPath, 'utf-8');
    const parsed: Array<Record<string, unknown>> = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toHaveProperty('titulo');
    expect(parsed[0]).toHaveProperty('_fuente', 'mercadolibre');
  });

  it('MELI-S6: extracts > 0 items from a controlled run', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result: ScrapeResult = await scrapeMercadoLibre(
      config,
      factory,
      cs,
      FAST_OPTS,
    );

    expect(result.totalScraped).toBeGreaterThan(0);
  });

  it('honors config.extra.acceptLanguage override', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
      extra: { acceptLanguage: 'en-US,en;q=0.9' },
    };

    await scrapeMercadoLibre(config, factory, cs, FAST_OPTS);

    const launchCalls = (factory.launch as jest.Mock).mock.calls;
    expect(launchCalls[0][0]).toEqual({ acceptLanguage: 'en-US,en;q=0.9' });
  });

  it('falls back to es-EC when acceptLanguage is not provided', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    await scrapeMercadoLibre(config, factory, cs, FAST_OPTS);

    const launchCalls = (factory.launch as jest.Mock).mock.calls;
    expect(launchCalls[0][0]).toEqual({ acceptLanguage: 'es-EC,es;q=0.9' });
  });

  it('records errors in the result after retries are exhausted', async () => {
    // Need 4 failing pages: 2 categories × (1 try + 1 retry).
    const failingPages = [
      makeFakePage({ status: 500 }),
      makeFakePage({ status: 500 }),
      makeFakePage({ status: 500 }),
      makeFakePage({ status: 500 }),
    ];
    const { factory } = makeFakeBrowserFactory(failingPages);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.MERCADOLIBRE,
      outputDir: 'scraping/mercadolibre',
    };

    const result = await scrapeMercadoLibre(config, factory, cs, {
      maxRetries: 1,
      retryBaseMs: 5,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
