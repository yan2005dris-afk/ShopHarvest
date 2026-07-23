import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { ProductResponseDto } from '../product-response.dto';
import { OfferResponseDto } from '../offer-response.dto';

/**
 * Wire-shape contract for `ProductResponseDto` (canonical fields only,
 * per `product-offer-split`: price/url/externalId moved to `OfferResponseDto`).
 *
 * Spec coverage (product-offer-catalog "Frontend Contracts Reflect
 * Offer-Level Data"):
 *   - `ProductResponseDto` exposes only canonical fields plus `offers: OfferResponseDto[]`.
 *   - The `@Expose` whitelist drops legacy flat fields (`price`, `productUrl`,
 *     `domainRuleId`) when the controller calls with
 *     `excludeExtraneousValues: true`.
 *   - `categoryId`/`brandId` survive as nullable/optional fields, unpopulated.
 */
describe('ProductResponseDto (canonical fields + offers[])', () => {
  it('strips legacy flat product fields via @Expose + excludeExtraneousValues', () => {
    const raw = {
      id: 'p1',
      title: 'Earbuds',
      description: 'Nice buds',
      imageUrl: 'https://cdn/img.png',
      categoryId: null,
      brandId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      offers: [],
      // The following MUST be stripped by the @Expose whitelist — they
      // belong on Offer now, not Product:
      price: '19.99',
      productUrl: 'https://x/y',
      domainRuleId: 'r1',
      externalId: 'ext-1',
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as unknown as Record<string, unknown>;

    expect(dto).not.toHaveProperty('price');
    expect(dto).not.toHaveProperty('productUrl');
    expect(dto).not.toHaveProperty('domainRuleId');
    expect(dto).not.toHaveProperty('externalId');
  });

  it('exposes an offers[] list of OfferResponseDto', () => {
    const raw = {
      id: 'p1',
      title: 'Earbuds',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      offers: [
        {
          id: 'o1',
          productId: 'p1',
          sourceId: 's1',
          url: 'https://x/y',
          price: '19.99',
          currency: 'USD',
          extractedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.offers).toHaveLength(1);
    expect(dto.offers[0]).toBeInstanceOf(OfferResponseDto);
    expect(dto.offers[0].price).toBe(19.99);
    expect(dto.offers[0].url).toBe('https://x/y');
  });

  it('preserves optional canonical fields when present (imageUrl, description, categoryId, brandId)', () => {
    const raw = {
      id: 'p1',
      title: 'Earbuds',
      description: 'Nice buds',
      imageUrl: 'https://cdn/img.png',
      categoryId: 'c1',
      brandId: 'b1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      offers: [],
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.imageUrl).toBe('https://cdn/img.png');
    expect(dto.description).toBe('Nice buds');
    expect(dto.categoryId).toBe('c1');
    expect(dto.brandId).toBe('b1');
  });

  it('returns an empty offers[] when the product has no offers', () => {
    const raw = {
      id: 'p1',
      title: 'Earbuds',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      offers: [],
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.offers).toEqual([]);
  });
});
