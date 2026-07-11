import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '../../../generated/operational';
import { ProductResponseDto } from '@web-scraping/contracts/products';
import { PriceHistoryResponseDto } from '@web-scraping/contracts/products';

// Prisma's `Decimal` is re-exported from the runtime client. In-process
// the controller never sees a JSON-string version (that's only after
// `JSON.stringify` + `JSON.parse`); the live row carries a real
// `Prisma.Decimal` instance. Re-importing the class here so the regression
// tests can construct one without touching Prisma client bootstrap.
const { Decimal } = Prisma;

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

describe('ProductResponseDto live-Decimal in-process path (4R HIGH #1)', () => {
  /**
   * 4R HIGH #1: the controller runs in-process — it receives a live
   * Prisma row with `price: new Prisma.Decimal('19.99')` (an OBJECT),
   * NOT a JSON-string '19.99'. The existing string-based test at the
   * top of this file exercises the AFTER-serialization path, not the
   * actual controller call. This block covers the in-process path
   * that the controller actually takes.
   */
  it('coerces a live Prisma.Decimal instance via @Type(() => Number)', () => {
    const liveRow = {
      id: 'p-dec-1',
      domainRuleId: 'r-1',
      title: 'Live Decimal',
      price: new Decimal('19.99'),
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(ProductResponseDto, liveRow, {
      excludeExtraneousValues: true,
    });

    expect(typeof dto.price).toBe('number');
    expect(dto.price).toBe(19.99);
  });

  it('does not throw when the Prisma row carries a populated priceHistory[] relation (4R BLOCKER guard)', () => {
    // The 4R BLOCKER: `plainToInstance(ProductResponseDto, row)` WITHOUT
    // `excludeExtraneousValues: true` causes class-transformer to recurse
    // into the nested `priceHistory` array. Each entry has its own
    // `price: Prisma.Decimal` and (historically) triggered
    // `[DecimalError] Invalid argument: undefined` from Decimal.js when
    // class-transformer walked the unannotated nested object.
    //
    // With `excludeExtraneousValues: true` the @Expose() whitelist
    // strips `priceHistory` BEFORE recursion, so the array is never
    // visited and the crash is impossible. This test pins that behavior
    // — if anyone removes the option from the controller call, this test
    // goes RED (along with the production endpoint).
    const rowWithHistory = {
      id: 'p-hist-1',
      domainRuleId: 'r-1',
      title: 'With history',
      price: new Decimal('19.99'),
      currency: 'USD',
      productUrl: 'https://temu.com/x',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      priceHistory: [
        {
          id: 'h-1',
          productId: 'p-hist-1',
          price: new Decimal('29.50'),
          currency: 'USD',
          capturedAt: new Date('2026-01-02T00:00:00.000Z'),
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          id: 'h-2',
          productId: 'p-hist-1',
          price: new Decimal('24.00'),
          currency: 'USD',
          capturedAt: new Date('2026-01-03T00:00:00.000Z'),
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        },
      ],
      // Also include the other leak surface from the 4R CRITICAL #1
      // finding (Prisma's joined `domainRule` relation).
      domainRule: {
        id: 'r-1',
        domain: 'temu.com',
        name: 'Temu',
      },
    };

    expect(() =>
      plainToInstance(ProductResponseDto, rowWithHistory, {
        excludeExtraneousValues: true,
      }),
    ).not.toThrow();

    // AND the whitelist must have stripped the leak surfaces.
    const dto = plainToInstance(ProductResponseDto, rowWithHistory, {
      excludeExtraneousValues: true,
    });
    expect((dto as unknown as Record<string, unknown>).priceHistory).toBeUndefined();
    expect((dto as unknown as Record<string, unknown>).domainRule).toBeUndefined();
    expect(typeof dto.price).toBe('number');
    expect(dto.price).toBe(19.99);
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
