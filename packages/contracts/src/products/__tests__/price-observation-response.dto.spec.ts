import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { PriceObservationResponseDto } from '../price-observation-response.dto';

/**
 * Wire-shape contract for `PriceObservationResponseDto` — replaces
 * `PriceHistoryResponseDto`. Hangs off `Offer` (via `offerId`), not
 * `Product`, per `product-offer-split`.
 */
describe('PriceObservationResponseDto (Decimal→number + @Expose whitelist)', () => {
  it('coerces price from JSON string ("19.99") to a real number', () => {
    const raw = {
      id: 'po1',
      offerId: 'o1',
      price: '19.99',
      currency: 'USD',
      observedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(PriceObservationResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.price).toBe(19.99);
    expect(typeof dto.price).toBe('number');
  });

  it('strips non-decorated fields via @Expose + excludeExtraneousValues', () => {
    const raw = {
      id: 'po1',
      offerId: 'o1',
      price: 19.99,
      currency: 'USD',
      observedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      // Must be stripped — no direct productId on PriceObservation:
      productId: 'p1',
    };
    const dto = plainToInstance(PriceObservationResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as Record<string, unknown>;

    expect(dto).not.toHaveProperty('productId');
    expect(dto.offerId).toBe('o1');
  });

  it('accepts a number price (not just string)', () => {
    const raw = {
      id: 'po1',
      offerId: 'o1',
      price: 19.99,
      currency: 'USD',
      observedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(PriceObservationResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.price).toBe(19.99);
  });
});
