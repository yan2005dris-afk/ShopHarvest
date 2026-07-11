import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSourceDto } from '../create-source.dto';

describe('CreateSourceDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(CreateSourceDto, body);
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
    code: 'ML_AR',
    name: 'Mercado Libre Argentina',
    baseUrl: 'https://www.mercadolibre.com.ar',
  });

  it('accepts a valid source payload', async () => {
    const { messages } = await validateBody(basePayload());
    expect(messages).toEqual([]);
  });

  it('rejects missing code', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      code: undefined,
    });
    expect(byProperty['code']).toBeDefined();
  });

  it('rejects empty code', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      code: '',
    });
    expect(byProperty['code']).toBeDefined();
  });

  it('rejects missing name', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      name: undefined,
    });
    expect(byProperty['name']).toBeDefined();
  });

  it('rejects missing baseUrl', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      baseUrl: undefined,
    });
    expect(byProperty['baseUrl']).toBeDefined();
  });

  it('rejects code longer than 50 characters', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      code: 'A'.repeat(51),
    });
    expect(byProperty['code']).toBeDefined();
  });

  it('accepts optional config JSON', async () => {
    const { messages } = await validateBody({
      ...basePayload(),
      config: { pagination: { type: 'scroll' } },
    });
    expect(messages).toEqual([]);
  });
});
