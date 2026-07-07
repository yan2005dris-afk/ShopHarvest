import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { ProductResponseDto } from '@web-scraping/contracts/products';
import { PriceHistoryResponseDto } from '@web-scraping/contracts/products';

/**
 * Spec 2 REQ-DT-1 (Decimal → number) regression guard.
 *
 * Prisma's `@db.Decimal(12, 2)` serializes to JSON as the string
 * '19.99'. Without `@Type(() => Number)` on the response DTO, the
 * frontend's `Product.price` is `string` and every arithmetic /
 * template format silently produces NaN or 'NaN'. This spec asserts
 * `plainToInstance(ProductResponseDto, rawRow).price` round-trips to
 * a real `number`.
 *
 * Lives under `__tests__/` (not next to the controller spec) so the
 * import-resolution path — workspace symlink → @web-scraping/contracts →
 * dual-build dist-cjs/ — is exercised end-to-end. If the contracts
 * package breaks CJS interop, this test fails before any controller
 * does.
 */
describe('ProductResponseDto Decimal serialization (Spec 2 REQ-DT-1)', () => {
  it('coerces price from Prisma JSON-string Decimal into a JS number', () => {
    // Prisma emits Decimal(12,2) as a JSON STRING in row form.
    const rawRow = {
      id: 'p-1',
      domainRuleId: 'r-1',
      title: 'Test',
      price: '19.99',
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(ProductResponseDto, rawRow);

    expect(dto.price).toBe(19.99);
    expect(typeof dto.price).toBe('number');
  });

  it('coerces integer-valued Decimal strings (e.g. "42") to a number', () => {
    const rawRow = {
      id: 'p-2',
      domainRuleId: 'r-1',
      title: 'Test',
      price: '42',
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(ProductResponseDto, rawRow);

    expect(dto.price).toBe(42);
    expect(typeof dto.price).toBe('number');
  });

  it('coerces a numeric Decimal (already a number) unchanged', () => {
    // Some Prisma paths return Decimal instances which serialize to
    // JSON as numbers via .toJSON(). The @Type still routes them
    // through Number(value) which is a no-op for real numbers.
    const rawRow = {
      id: 'p-3',
      domainRuleId: 'r-1',
      title: 'Test',
      price: 19.99,
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(ProductResponseDto, rawRow);

    expect(typeof dto.price).toBe('number');
    expect(dto.price).toBe(19.99);
  });

  it('preserves required identity fields through plainToInstance', () => {
    const rawRow = {
      id: 'p-4',
      domainRuleId: 'r-1',
      title: 'Test',
      price: '5.00',
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(ProductResponseDto, rawRow);

    expect(dto.id).toBe('p-4');
    expect(dto.title).toBe('Test');
    expect(dto.productUrl).toBe('https://temu.com/x');
    expect(dto.currency).toBe('USD');
  });
});

describe('PriceHistoryResponseDto Decimal serialization (Spec 2 REQ-DT-1)', () => {
  it('coerces price from Prisma JSON-string Decimal into a JS number', () => {
    const rawRow = {
      id: 'h-1',
      productId: 'p-1',
      price: '29.50',
      currency: 'USD',
      capturedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    };

    const dto = plainToInstance(PriceHistoryResponseDto, rawRow);

    expect(dto.price).toBe(29.5);
    expect(typeof dto.price).toBe('number');
  });

  it('preserves productId and currency through plainToInstance', () => {
    const rawRow = {
      id: 'h-2',
      productId: 'p-1',
      price: '29.50',
      currency: 'EUR',
      capturedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    };

    const dto = plainToInstance(PriceHistoryResponseDto, rawRow);

    expect(dto.productId).toBe('p-1');
    expect(dto.currency).toBe('EUR');
  });
});
