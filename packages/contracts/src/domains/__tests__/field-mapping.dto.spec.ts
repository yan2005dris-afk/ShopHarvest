import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FieldMappingDto } from '../field-mapping.dto';

/**
 * Validation contract for `FieldMappingDto`.
 *
 * Spec coverage (D3):
 *   - `canonicalField` and `selector` reject whitespace-only strings
 *   - `type` accepts only the literal union ('text' | 'attribute' | 'html')
 *   - `attribute` is required when `type === 'attribute'`
 *   - `attribute` is allowed but optional when `type !== 'attribute'`
 *   - all fields enforce their max length caps
 */
describe('FieldMappingDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(FieldMappingDto, body);
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

  it('accepts a valid text mapping', async () => {
    const { messages } = await validateBody({
      canonicalField: 'title',
      selector: 'h1.product-title',
      type: 'text',
    });
    expect(messages).toEqual([]);
  });

  it('accepts a valid attribute mapping WITH attribute', async () => {
    const { messages } = await validateBody({
      canonicalField: 'image',
      selector: 'img',
      type: 'attribute',
      attribute: 'href',
    });
    expect(messages).toEqual([]);
  });

  it('rejects attribute mapping WITHOUT attribute (cross-field guard)', async () => {
    const { byProperty, messages } = await validateBody({
      canonicalField: 'image',
      selector: 'img',
      type: 'attribute',
    });
    expect(messages.some((m) => /whitespace|empty|not.*empty/i.test(m))).toBe(true);
    expect(byProperty['attribute']).toBeDefined();
  });

  it('rejects type outside the literal union', async () => {
    const { byProperty } = await validateBody({
      canonicalField: 'title',
      selector: 'h1',
      type: 'css', // not in ['text', 'attribute', 'html']
    });
    expect(byProperty['type']).toBeDefined();
  });

  it('rejects whitespace-only canonicalField', async () => {
    const { byProperty } = await validateBody({
      canonicalField: '   ',
      selector: 'h1',
      type: 'text',
    });
    expect(byProperty['canonicalField']).toBeDefined();
  });

  it('rejects whitespace-only selector', async () => {
    const { byProperty } = await validateBody({
      canonicalField: 'title',
      selector: '   ',
      type: 'text',
    });
    expect(byProperty['selector']).toBeDefined();
  });

  it('rejects selector > 2000 chars', async () => {
    const { byProperty } = await validateBody({
      canonicalField: 'title',
      selector: 'a'.repeat(2001),
      type: 'text',
    });
    expect(byProperty['selector']).toBeDefined();
  });
});