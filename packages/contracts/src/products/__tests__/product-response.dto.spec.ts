import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { ProductResponseDto } from '../product-response.dto';

/**
 * Wire-shape contract for `ProductResponseDto`.
 *
 * Spec coverage (D3):
 *   - `plainToInstance(ProductResponseDto, { price: '19.99' })` coerces
 *     the JSON-stringified Prisma Decimal back to a real `number` (Spec 2
 *     REQ-DT-1). This is the core Decimal → number guarantee.
 *   - The `@Expose` whitelist drops nested relations (`domainRule`,
 *     `priceHistory[]`) when the controller calls with
 *     `excludeExtraneousValues: true`.
 *   - Optional fields survive without breaking validation
 *     (`imageUrl`, `description`, `sku`, `externalId`).
 */
describe('ProductResponseDto (Decimal→number + @Expose whitelist)', () => {
  it('coerces price from JSON string ("19.99") to a real number', () => {
    const raw = {
      id: 'p1',
      domainRuleId: 'r1',
      title: 'Earbuds',
      price: '19.99',
      currency: 'USD',
      productUrl: 'https://x/y',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto.price).toBe(19.99);
    expect(typeof dto.price).toBe('number');
  });

  it('strips non-decorated fields via @Expose + excludeExtraneousValues', () => {
    const raw = {
      id: 'p1',
      domainRuleId: 'r1',
      title: 'Earbuds',
      price: 19.99,
      currency: 'USD',
      productUrl: 'https://x/y',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      // The following MUST be stripped by the @Expose whitelist:
      domainRule: { id: 'r1', domain: 'temu.com' },
      priceHistory: [{ id: 'h1', price: '18.00' }],
      internalScore: 999,
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as Record<string, unknown>;

    expect(dto).not.toHaveProperty('domainRule');
    expect(dto).not.toHaveProperty('priceHistory');
    expect(dto).not.toHaveProperty('internalScore');
  });

  it('preserves optional fields when present (imageUrl, sku, description)', () => {
    const raw = {
      id: 'p1',
      domainRuleId: 'r1',
      title: 'Earbuds',
      price: 19.99,
      currency: 'USD',
      productUrl: 'https://x/y',
      imageUrl: 'https://cdn/img.png',
      sku: 'SKU-1',
      description: 'Nice buds',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    });
    expect(dto.imageUrl).toBe('https://cdn/img.png');
    expect(dto.sku).toBe('SKU-1');
    expect(dto.description).toBe('Nice buds');
  });

  it('accepts a number price (not just string)', () => {
    const raw = {
      id: 'p1',
      domainRuleId: 'r1',
      title: 'Earbuds',
      price: 19.99, // already a number
      currency: 'USD',
      productUrl: 'https://x/y',
      extractedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const dto = plainToInstance(ProductResponseDto, raw, {
      excludeExtraneousValues: true,
    });
    expect(dto.price).toBe(19.99);
  });
});