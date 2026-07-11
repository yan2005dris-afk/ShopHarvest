import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto } from '../create-category.dto';

describe('CreateCategoryDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(CreateCategoryDto, body);
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
    name: 'Celulares y Teléfonos',
  });

  it('accepts a valid root category payload', async () => {
    const { messages } = await validateBody(basePayload());
    expect(messages).toEqual([]);
  });

  it('accepts a child category with parentId', async () => {
    const { messages } = await validateBody({
      ...basePayload(),
      parentId: 'parent-uuid',
    });
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

  it('rejects non-string parentId', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      parentId: 123,
    });
    expect(byProperty['parentId']).toBeDefined();
  });
});
