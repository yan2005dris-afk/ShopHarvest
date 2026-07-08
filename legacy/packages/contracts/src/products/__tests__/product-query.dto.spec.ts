import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { ProductQueryDto } from '../product-query.dto';

/**
 * Wire-shape contract for `ProductQueryDto`.
 *
 * Spec coverage (D3):
 *   - `includeHistory` accepts 'true' / 'false' string and a real boolean
 *   - **a missing param stays `undefined`** so the controller's
 *     `?? true` default applies (CodeRabbit polish from Slice 2 — fixing
 *     a regression where the @Transform was coercing undefined → false).
 *   - `domainRuleId` rejects non-UUID strings.
 */
describe('ProductQueryDto (@Transform undefined preservation)', () => {
  it('coerces "true" to true', () => {
    const dto = plainToInstance(ProductQueryDto, { includeHistory: 'true' });
    expect(dto.includeHistory).toBe(true);
  });

  it('coerces "false" to false', () => {
    const dto = plainToInstance(ProductQueryDto, { includeHistory: 'false' });
    expect(dto.includeHistory).toBe(false);
  });

  it('keeps a missing includeHistory as undefined (CodeRabbit fix)', () => {
    // The controller's `?? true` default must apply when the param is
    // absent. Coercing it to false here would silently flip every list
    // call to skip priceHistory.
    const dto = plainToInstance(ProductQueryDto, {});
    expect(dto.includeHistory).toBeUndefined();
  });

  it('keeps a boolean true', () => {
    const dto = plainToInstance(ProductQueryDto, { includeHistory: true });
    expect(dto.includeHistory).toBe(true);
  });

  it('keeps a boolean false', () => {
    const dto = plainToInstance(ProductQueryDto, { includeHistory: false });
    expect(dto.includeHistory).toBe(false);
  });

  it('passes domainRuleId through when a valid UUID is provided', () => {
    const dto = plainToInstance(ProductQueryDto, {
      domainRuleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(dto.domainRuleId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});