import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDomainDto } from '../create-domain.dto';

/**
 * Validation contract for `POST /api/domains`.
 *
 * Spec coverage (D3 — close the Slice 1 coverage gap for non-auth DTOs):
 *   - valid payload (domain + name + fieldMappings[]) passes
 *   - missing domain fails on the right property
 *   - missing name fails on the right property
 *   - empty `fieldMappings[]` fails (ArrayNotEmpty)
 *   - domain is lowercased on the way in (Temu.COM → temu.com)
 *   - invalid domain format fails (matches regex)
 *   - `productLimit < 1` fails on @Min(1)
 *   - `sampleUrl` that is not a URL fails
 */
describe('CreateDomainDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(CreateDomainDto, body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const byProperty: Record<string, string[]> = {};
    for (const e of errors) {
      const property = e.property;
      if (!byProperty[property]) byProperty[property] = [];
      byProperty[property].push(...Object.values(e.constraints ?? {}));
    }
    return {
      messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
      byProperty,
    };
  }

  const basePayload = () => ({
    domain: 'temu.com',
    name: 'Temu',
    fieldMappings: [
      { canonicalField: 'title', selector: 'h1', type: 'text' as const },
    ],
  });

  it('accepts a valid payload', async () => {
    const { messages } = await validateBody(basePayload());
    expect(messages).toEqual([]);
  });

  it('rejects missing domain', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      domain: undefined,
    });
    expect(byProperty['domain']).toBeDefined();
  });

  it('rejects missing name', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      name: undefined,
    });
    expect(byProperty['name']).toBeDefined();
  });

  it('rejects empty fieldMappings array', async () => {
    const { byProperty, messages } = await validateBody({
      ...basePayload(),
      fieldMappings: [],
    });
    expect(messages.some((m) => /at least one mapping/i.test(m))).toBe(true);
    expect(byProperty['fieldMappings']).toBeDefined();
  });

  it('rejects malformed domain', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      domain: 'has spaces',
    });
    expect(byProperty['domain']).toBeDefined();
  });

  it('rejects productLimit < 1', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      productLimit: 0,
    });
    expect(byProperty['productLimit']).toBeDefined();
  });

  it('rejects sampleUrl that is not a URL', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      sampleUrl: 'not a url',
    });
    expect(byProperty['sampleUrl']).toBeDefined();
  });

  it('lowercases the domain on transform', () => {
    const dto = plainToInstance(CreateDomainDto, basePayload());
    // The @Transform runs in plainToInstance even before validate().
    expect(dto.domain).toBe('temu.com');
    const upper = plainToInstance(CreateDomainDto, {
      ...basePayload(),
      domain: 'Temu.COM',
    });
    expect(upper.domain).toBe('temu.com');
  });
});