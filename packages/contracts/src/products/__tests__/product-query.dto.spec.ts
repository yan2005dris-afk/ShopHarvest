import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductQueryDto } from '../product-query.dto';

/**
 * Wire-shape contract for `ProductQueryDto`.
 *
 * `includeHistory` was replaced by `page`/`limit` pagination in the
 * paginated product list feature — this spec covers the current fields.
 */
describe('ProductQueryDto', () => {
  it('defaults page to 1 and limit to 24 when omitted', () => {
    const dto = plainToInstance(ProductQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(24);
  });

  it('coerces string page/limit to numbers', () => {
    const dto = plainToInstance(ProductQueryDto, { page: '3', limit: '50' });
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('rejects limit above 100', async () => {
    const dto = plainToInstance(ProductQueryDto, { limit: '200' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('trims the search term', () => {
    const dto = plainToInstance(ProductQueryDto, { q: '  camisa  ' });
    expect(dto.q).toBe('camisa');
  });

  it('rejects a search term shorter than 2 characters after trim', async () => {
    const dto = plainToInstance(ProductQueryDto, { q: ' a ' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'q')).toBe(true);
  });

  it('passes domainRuleId through when a valid UUID is provided', () => {
    const dto = plainToInstance(ProductQueryDto, {
      domainRuleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(dto.domainRuleId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects domainRuleId when not a valid UUID', async () => {
    const dto = plainToInstance(ProductQueryDto, { domainRuleId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'domainRuleId')).toBe(true);
  });
});
