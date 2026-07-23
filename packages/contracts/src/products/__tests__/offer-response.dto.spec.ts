import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { OfferResponseDto } from '../offer-response.dto';

/**
 * Wire-shape contract for `OfferResponseDto` — the product-at-a-site
 * listing introduced by `product-offer-split` (price/url/externalId moved
 * off `Product` onto `Offer`).
 */
describe('OfferResponseDto (Decimal→number + @Expose whitelist)', () => {
  it('coerces price from JSON string ("19.99") to a real number', () => {
    const raw = {
      id: 'o1',
      productId: 'p1',
      sourceId: 's1',
      url: 'https://x/y',
      price: '19.99',
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(OfferResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.price).toBe(19.99);
    expect(typeof dto.price).toBe('number');
  });

  it('strips non-decorated fields via @Expose + excludeExtraneousValues', () => {
    const raw = {
      id: 'o1',
      productId: 'p1',
      sourceId: 's1',
      url: 'https://x/y',
      price: 19.99,
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
      // Must be stripped:
      rawData: { extra: true },
      internalScore: 999,
    };
    const dto = plainToInstance(OfferResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as unknown as Record<string, unknown>;

    expect(dto).not.toHaveProperty('internalScore');
  });

  it('preserves optional fields when present (externalId, sku, domainRuleId)', () => {
    const raw = {
      id: 'o1',
      productId: 'p1',
      sourceId: 's1',
      domainRuleId: 'dr1',
      externalId: 'ext-1',
      url: 'https://x/y',
      sku: 'SKU-1',
      price: 19.99,
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(OfferResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.externalId).toBe('ext-1');
    expect(dto.sku).toBe('SKU-1');
    expect(dto.domainRuleId).toBe('dr1');
  });

  it('accepts a number price (not just string)', () => {
    const raw = {
      id: 'o1',
      productId: 'p1',
      sourceId: 's1',
      url: 'https://x/y',
      price: 19.99,
      currency: 'USD',
      extractedAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(OfferResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.price).toBe(19.99);
  });
});
