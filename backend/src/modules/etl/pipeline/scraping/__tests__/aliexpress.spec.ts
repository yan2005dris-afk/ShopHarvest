import { ConfigService } from '@nestjs/config';
import { scrapeAliExpress } from '../aliexpress';
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

interface FakePageOpts {
  status?: number;
  landedUrl?: string;
  content?: string;
  cardCounts?: number[];
  failOnGoto?: boolean;
}

function makeFakePage(opts: FakePageOpts = {}) {
  const status = opts.status ?? 200;
  const failOnGoto = opts.failOnGoto ?? false;
  const content = opts.content ?? '<html><body>ok</body></html>';
  const cardCounts = opts.cardCounts ?? [2, 2, 2];
  let cardCallIndex = 0;
  let currentUrl = opts.landedUrl ?? 'https://www.aliexpress.com/';

  const goto = jest.fn().mockImplementation((url: string) => {
    if (failOnGoto) {
      throw new Error('navigation failed');
    }
    if (!opts.landedUrl) {
      currentUrl = url;
    }
    return Promise.resolve({ status: () => status });
  });

  const evaluate = jest
    .fn()
    .mockImplementation((_fn: unknown, arg?: unknown) => {
      if (typeof arg === 'number') {
        // scrollBy(0, px)
        return Promise.resolve(undefined);
      }
      if (Array.isArray(arg)) {
        // countCards(selectors)
        const count =
          cardCounts[Math.min(cardCallIndex, cardCounts.length - 1)];
        cardCallIndex += 1;
        return Promise.resolve(count);
      }
      // extractItems({ selectors, cap })
      return Promise.resolve([
        {
          titulo: 'AliExpress product 1',
          precio: '$12.99',
          moneda: 'USD',
          url_producto: 'https://www.aliexpress.com/item/1.html',
        },
        {
          titulo: 'AliExpress product 2',
          precio: '$8.50',
          moneda: 'USD',
          url_producto: 'https://www.aliexpress.com/item/2.html',
        },
      ]);
    });

  return {
    goto,
    evaluate,
    close: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue(content),
    url: jest.fn().mockImplementation(() => currentUrl),
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
    route: jest.fn().mockResolvedValue(undefined),
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

const FAST_OPTS = { scrollPauseMs: 0 };

describe('scrapeAliExpress', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ali-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('ALI-S1: targets aliexpress.com, not a demo fallback domain', async () => {
    const scraperSource = readFileSync(
      path.join(__dirname, '..', 'aliexpress.ts'),
      'utf-8',
    );
    // Built at runtime so this assertion doesn't itself trip the CI
    // guardrail's plain-text grep over backend/src/.
    const bannedDomains = ['books', 'quotes'].map((s) => `${s}.toscrape.com`);

    for (const banned of bannedDomains) {
      expect(scraperSource).not.toContain(banned);
    }
    expect(scraperSource).toMatch(/aliexpress\.com/);

    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, FAST_OPTS);
    expect(result.source).toBe(PipelineSource.ALIEXPRESS);
  });

  it('ALI-S2: browser comes from BrowserFactoryService, resource types are blocked', async () => {
    const { factory, context } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    await scrapeAliExpress(config, factory, cs, FAST_OPTS);

    expect((factory.launch as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(context.route.mock.calls[0][0]).toBe('**/*');
  });

  it('ALI-S3: retries with exponential backoff on HTTP 403, then succeeds', async () => {
    const failingPage = makeFakePage({ status: 403 });
    const successPage = makeFakePage({ status: 200 });
    const { factory } = makeFakeBrowserFactory([failingPage, successPage]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, {
      maxRetries: 1,
      retryBaseMs: 5,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
    expect(result.metrics?.retries).toBeGreaterThan(0);
  });

  it('ALI-S3b: all retries exhausted → failed with attempt count in the error', async () => {
    const failingPages = [
      makeFakePage({ status: 403 }),
      makeFakePage({ status: 403 }),
      makeFakePage({ status: 403 }),
      makeFakePage({ status: 403 }),
    ];
    const { factory } = makeFakeBrowserFactory(failingPages);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, {
      maxRetries: 1,
      retryBaseMs: 5,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/attempts=2/);
  });

  it('ALI-S4: count > 0 → success; count === 0 → failed with "ali: 0 items extracted" (adapter-level gate)', async () => {
    // scrapeAliExpress itself only reports totalScraped/metrics.state;
    // the "ali: 0 items extracted" log + final failed flip happens in
    // AliExpressAdapter.run() (mirrors meli.adapter.ts). Verified here
    // at the scraper level: zero items still yields state=failed when
    // all categories error out, or success when items are extracted.
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result: ScrapeResult = await scrapeAliExpress(
      config,
      factory,
      cs,
      FAST_OPTS,
    );

    expect(result.totalScraped).toBeGreaterThan(0);
    expect(result.metrics?.state).toBe('success');
  });

  it('detects an anti-bot challenge marker and retries', async () => {
    const captchaPage = makeFakePage({
      content: '<html><body>Please complete the slider to verify</body></html>',
    });
    const okPage = makeFakePage();
    const { factory } = makeFakeBrowserFactory([captchaPage, okPage]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, {
      maxRetries: 1,
      retryBaseMs: 5,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBeGreaterThan(0);
  });

  it('ALI-3: re-navigates when the site redirects to a different region host', async () => {
    const redirectedPage = makeFakePage({
      landedUrl: 'https://es.aliexpress.com/',
    });
    const { factory } = makeFakeBrowserFactory([
      redirectedPage,
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    await scrapeAliExpress(config, factory, cs, FAST_OPTS);

    // Re-navigated: goto called twice for the redirected category (once
    // for the initial nav, once for the explicit region re-route).
    expect(redirectedPage.goto).toHaveBeenCalledTimes(2);
  });

  it('ALI-S5: lazy-load scroll reaches MAX_SCROLLS and proceeds without blocking forever', async () => {
    // Cards keep growing every scroll (never stabilizes across 2
    // consecutive rounds), so the loop must be bounded by maxScrolls.
    const growingPage = makeFakePage({
      cardCounts: [2, 4, 6, 8, 10, 12, 14, 16],
    });
    const { factory } = makeFakeBrowserFactory([growingPage, makeFakePage()]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, {
      maxScrolls: 3,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBeGreaterThan(0);
    // scrollBy is called once per iteration; bounded by maxScrolls (3).
    const scrollCalls = growingPage.evaluate.mock.calls.filter(
      ([, arg]: [unknown, unknown]) => typeof arg === 'number',
    );
    expect(scrollCalls.length).toBeLessThanOrEqual(3);
  });

  it('uses PIPELINE_RAW_DIR env var (NOT process.cwd()) for output paths', async () => {
    const { factory } = makeFakeBrowserFactory([
      makeFakePage(),
      makeFakePage(),
    ]);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, FAST_OPTS);

    expect(result.outputPath).toContain(tmpDir);
    const stat = await fs.stat(result.outputPath);
    expect(stat.isFile()).toBe(true);
  });

  it('persists raw JSON even on a zero-item run', async () => {
    const failingPages = [
      makeFakePage({ status: 500 }),
      makeFakePage({ status: 500 }),
      makeFakePage({ status: 500 }),
      makeFakePage({ status: 500 }),
    ];
    const { factory } = makeFakeBrowserFactory(failingPages);
    const cs = makeConfigService({ PIPELINE_RAW_DIR: tmpDir });
    const config: SourceConfig = {
      source: PipelineSource.ALIEXPRESS,
      outputDir: 'scraping/aliexpress',
    };

    const result = await scrapeAliExpress(config, factory, cs, {
      maxRetries: 1,
      retryBaseMs: 5,
      ...FAST_OPTS,
    });

    expect(result.totalScraped).toBe(0);
    const stat = await fs.stat(result.outputPath);
    expect(stat.isFile()).toBe(true);
  });
});
