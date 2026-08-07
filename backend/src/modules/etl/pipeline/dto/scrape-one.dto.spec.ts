import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScrapeOneDto } from './scrape-one.dto';

describe('ScrapeOneDto', () => {
  it('accepts a plain outputDir with an optional hostname region', async () => {
    const dto = plainToInstance(ScrapeOneDto, {
      outputDir: 'aliexpress',
      extra: { region: 'www.aliexpress.com' },
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('accepts no extra at all', async () => {
    const dto = plainToInstance(ScrapeOneDto, { outputDir: 'temu' });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a region that is not a bare hostname (SSRF vector)', async () => {
    const dto = plainToInstance(ScrapeOneDto, {
      outputDir: 'aliexpress',
      extra: { region: 'evil.example.com:443@internal' },
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'extra')).toBe(true);
  });

  it('rejects a region containing a path or scheme', async () => {
    for (const region of [
      'https://internal.example.com',
      'www.example.com/path',
      'user:pass@internal.example.com',
      'localhost',
      '127.0.0.1',
    ]) {
      const dto = plainToInstance(ScrapeOneDto, {
        outputDir: 'aliexpress',
        extra: { region },
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'extra')).toBe(
        true,
        `region "${region}" should be rejected`,
      );
    }
  });

  it('rejects unknown keys inside extra (forbidNonWhitelisted)', async () => {
    const dto = plainToInstance(ScrapeOneDto, {
      outputDir: 'aliexpress',
      extra: { region: 'www.aliexpress.com', evil: 'x' },
    });
    // Mirror the global ValidationPipe options from main.ts.
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
