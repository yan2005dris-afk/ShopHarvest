import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngestProductsDto } from './ingest-products.dto';

/**
 * Validation contract for `POST /products/ingest`. The runtime ValidationPipe
 * is configured globally (see main.ts); we replicate its options here and
 * assert the DTO behavior directly.
 */
describe('IngestProductsDto', () => {
  async function validateBody(body: unknown): Promise<string[]> {
    const dto = plainToInstance(IngestProductsDto, body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('accepts a valid payload', async () => {
    const errors = await validateBody({
      domain: 'temu.com',
      pageUrl: 'https://temu.com/x',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'X' }],
    });
    expect(errors).toEqual([]);
  });

  it('rejects empty products array', async () => {
    const errors = await validateBody({
      domain: 'temu.com',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing domain', async () => {
    const errors = await validateBody({
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'X' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing products', async () => {
    const errors = await validateBody({
      domain: 'temu.com',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects pageUrl that is not a valid URL', async () => {
    const errors = await validateBody({
      domain: 'temu.com',
      pageUrl: 'not-a-url',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'X' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown extra properties', async () => {
    const errors = await validateBody({
      domain: 'temu.com',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      products: [{ title: 'X' }],
      legacy: 'should-not-pass',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
