import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBrandDto } from '../create-brand.dto';

describe('CreateBrandDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(CreateBrandDto, body);
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
    name: 'Samsung',
    aliases: ['Sam', 'SSG'],
  });

  it('accepts a valid brand payload with aliases', async () => {
    const { messages } = await validateBody(basePayload());
    expect(messages).toEqual([]);
  });

  it('rejects missing name', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      name: undefined,
    });
    expect(byProperty['name']).toBeDefined();
  });

  it('rejects empty name', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      name: '',
    });
    expect(byProperty['name']).toBeDefined();
  });

  it('rejects name longer than 120 characters', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      name: 'A'.repeat(121),
    });
    expect(byProperty['name']).toBeDefined();
  });

  it('rejects empty aliases array', async () => {
    const { byProperty, messages } = await validateBody({
      ...basePayload(),
      aliases: [],
    });
    expect(messages.some((m) => /empty/i.test(m))).toBe(true);
    expect(byProperty['aliases']).toBeDefined();
  });

  it('rejects missing aliases', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      aliases: undefined,
    });
    expect(byProperty['aliases']).toBeDefined();
  });

  it('rejects non-string alias entries', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      aliases: [123],
    });
    expect(byProperty['aliases']).toBeDefined();
  });
});
