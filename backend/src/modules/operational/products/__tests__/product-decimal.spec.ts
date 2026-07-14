import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '../../../../generated/operational';
import {
  ProductResponseDto,
  OfferResponseDto,
  PriceObservationResponseDto,
} from '@web-scraping/contracts/products';

// Prisma's `Decimal` is re-exported from the runtime client. In-process
// the controller never sees a JSON-string version (that's only after
// `JSON.stringify` + `JSON.parse`); the live row carries a real
// `Prisma.Decimal` instance. Re-importing the class here so the regression
// tests can construct one without touching Prisma client bootstrap.
const { Decimal } = Prisma;

/**
 * Spec 2 REQ-DT-1 (Decimal → number) regression guard, updated for
 * `product-offer-split`: price/url now live on `Offer`, not the flat
 * `Product`. `ProductResponseDto` carries only canonical fields +
 * `offers[]`.
 *
 * Lives under `__tests__/` (not next to the controller spec) so the
 * import-resolution path — workspace symlink → @web-scraping/contracts →
 * dual-build dist-cjs/ — is exercised end-to-end. If the contracts
 * package breaks CJS interop, this test fails before any controller does.
 */
describe('OfferResponseDto Decimal serialization (Spec 2 REQ-DT-1)', () => {
  it('coerces price from Prisma JSON-string Decimal into a JS number', () => {
    // Prisma emits Decimal(12,2) as a JSON STRING in row form.
    const rawRow = {
      id: 'o-1',
      productId: 'p-1',
      sourceId: 's-1',
      url: 'https://temu.com/x',
      price: '19.99',
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(OfferResponseDto, rawRow);

    expect(dto.price).toBe(19.99);
    expect(typeof dto.price).toBe('number');
  });

  it('coerces integer-valued Decimal strings (e.g. "42") to a number', () => {
    const rawRow = {
      id: 'o-2',
      productId: 'p-1',
      sourceId: 's-1',
      url: 'https://temu.com/x',
      price: '42',
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(OfferResponseDto, rawRow);

    expect(dto.price).toBe(42);
    expect(typeof dto.price).toBe('number');
  });

  it('coerces a live Prisma.Decimal instance via @Type(() => Number)', () => {
    const liveRow = {
      id: 'o-dec-1',
      productId: 'p-1',
      sourceId: 's-1',
      url: 'https://temu.com/x',
      price: new Decimal('19.99'),
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(OfferResponseDto, liveRow, {
      excludeExtraneousValues: true,
    });

    expect(typeof dto.price).toBe('number');
    expect(dto.price).toBe(19.99);
  });

  it('preserves url and productId through plainToInstance', () => {
    const rawRow = {
      id: 'o-4',
      productId: 'p-1',
      sourceId: 's-1',
      url: 'https://temu.com/x',
      price: '5.00',
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };

    const dto = plainToInstance(OfferResponseDto, rawRow);

    expect(dto.id).toBe('o-4');
    expect(dto.productId).toBe('p-1');
    expect(dto.url).toBe('https://temu.com/x');
    expect(dto.currency).toBe('USD');
  });
});

describe('ProductResponseDto (canonical fields, no live-Decimal leak)', () => {
  /**
   * `product-offer-split`: the controller runs in-process — it receives a
   * live Prisma row where the joined `offers[]` relation carries its own
   * `price: new Prisma.Decimal(...)`. `ProductResponseDto` no longer has
   * its own `price`; it must NOT throw and must strip anything not on its
   * canonical whitelist (title/description/imageUrl/categoryId/brandId/
   * offers[]).
   */
  it('does not throw when the Prisma row carries a populated offers[] relation with live Decimal prices (4R BLOCKER guard)', () => {
    const rowWithOffers = {
      id: 'p-hist-1',
      title: 'With offers',
      description: null,
      imageUrl: null,
      categoryId: null,
      brandId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      offers: [
        {
          id: 'o-1',
          productId: 'p-hist-1',
          sourceId: 's-1',
          url: 'https://temu.com/x',
          price: new Decimal('19.99'),
          currency: 'USD',
          extractedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    };

    expect(() =>
      plainToInstance(ProductResponseDto, rowWithOffers, {
        excludeExtraneousValues: true,
      }),
    ).not.toThrow();

    const dto = plainToInstance(ProductResponseDto, rowWithOffers, {
      excludeExtraneousValues: true,
    });
    expect(dto.offers).toHaveLength(1);
    expect(typeof dto.offers[0].price).toBe('number');
    expect(dto.offers[0].price).toBe(19.99);
  });
});

describe('PriceObservationResponseDto Decimal serialization (Spec 2 REQ-DT-1)', () => {
  it('coerces price from Prisma JSON-string Decimal into a JS number', () => {
    const rawRow = {
      id: 'po-1',
      offerId: 'o-1',
      price: '29.50',
      currency: 'USD',
      observedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    };

    const dto = plainToInstance(PriceObservationResponseDto, rawRow);

    expect(dto.price).toBe(29.5);
    expect(typeof dto.price).toBe('number');
  });

  it('preserves offerId and currency through plainToInstance', () => {
    const rawRow = {
      id: 'po-2',
      offerId: 'o-1',
      price: '29.50',
      currency: 'EUR',
      observedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    };

    const dto = plainToInstance(PriceObservationResponseDto, rawRow);

    expect(dto.offerId).toBe('o-1');
    expect(dto.currency).toBe('EUR');
  });
});
