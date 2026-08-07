import { ConfigService } from '@nestjs/config';
import { readTemuExtensionExport } from '../temu';
import type { SourceConfig } from '@web-scraping/contracts/pipeline';
import {
  PipelineSource,
  BadExtensionExportError,
} from '@web-scraping/contracts/pipeline';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { readFileSync } from 'fs';

function makeConfigService(env: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
}

const VALID_EXPORT = {
  source: 'temu',
  capturedAt: '2026-07-10T12:00:00.000Z',
  products: [
    {
      productId: 'p1',
      title: 'Temu product 1',
      price: 9.99,
      currency: 'USD',
      category: 'home',
      url: 'https://www.temu.com/item-1.html',
    },
    {
      productId: 'p2',
      title: 'Temu product 2',
      price: 14.5,
      currency: 'USD',
      category: 'home',
      url: 'https://www.temu.com/item-2.html',
    },
  ],
};

describe('readTemuExtensionExport', () => {
  let tmpDir: string;
  let exportPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-'));
    exportPath = path.join(tmpDir, 'extension_export.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('EXT-4/EXT-5: does not reference Playwright or BrowserFactoryService', () => {
    const source = readFileSync(path.join(__dirname, '..', 'temu.ts'), 'utf-8');
    // Built at runtime so this assertion doesn't itself trip the CI
    // guardrail's plain-text grep over backend/src/.
    const bannedDomains = ['books', 'quotes'].map((s) => `${s}.toscrape.com`);
    expect(source).not.toMatch(/playwright/i);
    expect(source).not.toMatch(/BrowserFactoryService/);
    for (const banned of bannedDomains) {
      expect(source).not.toContain(banned);
    }
  });

  it('5.1: happy path — valid export persisted as-is, success', async () => {
    await fs.writeFile(exportPath, JSON.stringify(VALID_EXPORT), 'utf-8');
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: exportPath,
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    const result = await readTemuExtensionExport(config, cs);

    expect(result.totalScraped).toBe(2);
    expect(result.metrics?.state).toBe('success');
    expect(result.errors).toEqual([]);

    const persisted: unknown = JSON.parse(
      await fs.readFile(result.outputPath, 'utf-8'),
    );
    expect(persisted).toEqual(VALID_EXPORT);
  });

  it('5.2: missing export file → BadExtensionExportError("missing")', async () => {
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: path.join(tmpDir, 'does-not-exist.json'),
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    await expect(readTemuExtensionExport(config, cs)).rejects.toThrow(
      BadExtensionExportError,
    );
    await expect(readTemuExtensionExport(config, cs)).rejects.toMatchObject({
      reason: 'missing',
    });
  });

  it('5.3: malformed JSON → BadExtensionExportError with parse detail', async () => {
    await fs.writeFile(exportPath, '{ not valid json', 'utf-8');
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: exportPath,
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    await expect(readTemuExtensionExport(config, cs)).rejects.toMatchObject({
      reason: 'parse',
    });
  });

  it('5.4: schema mismatch — missing products array → error names the field', async () => {
    await fs.writeFile(
      exportPath,
      JSON.stringify({
        source: 'temu',
        capturedAt: '2026-07-10T12:00:00.000Z',
      }),
      'utf-8',
    );
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: exportPath,
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    await expect(readTemuExtensionExport(config, cs)).rejects.toMatchObject({
      reason: 'schema',

      message: expect.stringContaining('products'),
    });
  });

  it('rejects an export whose source does not match (e.g. a shein export fed to temu)', async () => {
    await fs.writeFile(
      exportPath,
      JSON.stringify({ ...VALID_EXPORT, source: 'shein' }),
      'utf-8',
    );
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: exportPath,
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    await expect(readTemuExtensionExport(config, cs)).rejects.toMatchObject({
      reason: 'schema',

      message: expect.stringContaining('source'),
    });
  });

  it('EXT-6: zero products still persists raw payload but state is failed', async () => {
    await fs.writeFile(
      exportPath,
      JSON.stringify({ ...VALID_EXPORT, products: [] }),
      'utf-8',
    );
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: exportPath,
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    const result = await readTemuExtensionExport(config, cs);

    expect(result.totalScraped).toBe(0);
    expect(result.metrics?.state).toBe('failed');
    expect(result.errors).toContain('temu: 0 items extracted');
    const stat = await fs.stat(result.outputPath);
    expect(stat.isFile()).toBe(true);
  });

  it('EXT-1: uses PIPELINE_RAW_DIR env var (NOT process.cwd()) for output paths', async () => {
    await fs.writeFile(exportPath, JSON.stringify(VALID_EXPORT), 'utf-8');
    const cs = makeConfigService({
      EXTENSION_EXPORT_PATH: exportPath,
      PIPELINE_RAW_DIR: tmpDir,
    });
    const config: SourceConfig = {
      source: PipelineSource.TEMU,
      outputDir: 'scraping/temu',
    };

    const result = await readTemuExtensionExport(config, cs);
    expect(result.outputPath).toContain(tmpDir);
  });
});
