import { Offer } from '../../domain/offer.entity';
import { PriceObservation } from '../../domain/price-observation.entity';
import { Product } from '../../domain/product.entity';
import { ProductMapper } from './product.mapper';
import type { PrismaProductWithOffers } from './product.mapper';
import {
  Prisma,
  type Offer as PrismaOffer,
  type PriceObservation as PrismaPriceObservation,
  type Product as PrismaProduct,
} from '../../../../../generated/operational';

const { Decimal } = Prisma;

const baseRow: PrismaProductWithOffers = {
  id: 'p_1',
  title: 'Camisa',
  description: 'Algodón',
  imageUrl: 'https://shop.com/x.jpg',
  categoryId: 'cat_x',
  brandId: 'brand_y',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  offers: [],
};

function makeOfferRow(
  overrides: Partial<{
    id: string;
    productId: string;
    sourceId: string;
    domainRuleId: string | null;
    url: string;
    externalId: string | null;
    sku: string | null;
    currency: string;
    price: unknown;
    rawData: unknown;
    extractedAt: Date;
  }> = {},
): PrismaOffer {
  // Prisma's strict types make hand-rolled row fixtures noisy. Cast to
  // the generated type so the mapper can be exercised directly.
  return {
    id: 'o_1',
    productId: 'p_1',
    sourceId: 's_1',
    domainRuleId: null,
    url: 'https://temu.com/x',
    externalId: null,
    sku: null,
    currency: 'USD',
    price: new Decimal('19.99'),
    rawData: null,
    extractedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as PrismaOffer;
}

function makeObsRow(
  overrides: Partial<{
    id: string;
    offerId: string;
    price: unknown;
    currency: string;
    observedAt: Date;
    createdAt: Date;
  }> = {},
): PrismaPriceObservation {
  return {
    id: 'po_1',
    offerId: 'o_1',
    price: new Decimal('19.99'),
    currency: 'USD',
    observedAt: new Date('2026-01-02T00:00:00Z'),
    createdAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  } as unknown as PrismaPriceObservation;
}

function makeProductRow(): PrismaProductWithOffers {
  return baseRow;
}

describe('ProductMapper', () => {
  describe('toDomain', () => {
    it('maps a Prisma row to a Product with empty offers', () => {
      const product = ProductMapper.toDomain(makeProductRow());
      expect(product.id).toBe('p_1');
      expect(product.title).toBe('Camisa');
      expect(product.description).toBe('Algodón');
      expect(product.imageUrl).toBe('https://shop.com/x.jpg');
      expect(product.categoryId).toBe('cat_x');
      expect(product.brandId).toBe('brand_y');
      expect(product.offers).toEqual([]);
    });

    it('maps nested offers and coerces price Decimal to a JS number', () => {
      const row: PrismaProductWithOffers = {
        ...makeProductRow(),
        offers: [
          makeOfferRow({
            sku: 'SKU-1',
            rawData: { foo: 'bar' },
          }),
        ],
      };

      const product = ProductMapper.toDomain(row);
      expect(product.offers).toHaveLength(1);
      const offer = product.offers[0];
      expect(offer).toBeInstanceOf(Offer);
      expect(offer.id).toBe('o_1');
      expect(offer.price).toBe(19.99);
      expect(typeof offer.price).toBe('number');
      expect(offer.sku).toBe('SKU-1');
      expect(offer.rawData).toEqual({ foo: 'bar' });
    });

    it('handles missing offers gracefully', () => {
      const row = { ...baseRow } as unknown as PrismaProductWithOffers;
      const product = ProductMapper.toDomain(row);
      expect(product.offers).toEqual([]);
    });

    it('round-trips through toJSON()', () => {
      const product = ProductMapper.toDomain(makeProductRow());
      const snap = product.toJSON();
      const reloaded = Product.fromPersistence(snap);
      expect(reloaded.id).toBe('p_1');
      expect(reloaded.title).toBe('Camisa');
    });
  });

  describe('offerToDomain', () => {
    it('coerces a live Prisma.Decimal price', () => {
      const offer = ProductMapper.offerToDomain(
        makeOfferRow({ price: new Decimal('29.50') }),
      );
      expect(offer.price).toBe(29.5);
      expect(typeof offer.price).toBe('number');
    });

    it('coerces a JSON-string price (post-serialization)', () => {
      const offer = ProductMapper.offerToDomain(
        makeOfferRow({ price: '29.50' }),
      );
      expect(offer.price).toBe(29.5);
    });

    it('coerces a numeric price', () => {
      const offer = ProductMapper.offerToDomain(makeOfferRow({ price: 29 }));
      expect(offer.price).toBe(29);
    });

    it('preserves a null rawData', () => {
      const offer = ProductMapper.offerToDomain(
        makeOfferRow({ rawData: null, sku: null }),
      );
      expect(offer.rawData).toBeNull();
    });
  });

  describe('priceObservationToDomain', () => {
    it('maps a Prisma PriceObservation row with Decimal price', () => {
      const obs = ProductMapper.priceObservationToDomain(makeObsRow());
      expect(obs).toBeInstanceOf(PriceObservation);
      expect(obs.price).toBe(19.99);
      expect(obs.currency).toBe('USD');
    });
  });

  describe('newProductPersistence', () => {
    it('returns the canonical Prisma-shaped bag', () => {
      const out = ProductMapper.newProductPersistence({
        id: 'p_1',
        title: 'X',
        description: 'Y',
        imageUrl: 'https://x',
      });
      expect(out).toEqual({
        id: 'p_1',
        title: 'X',
        description: 'Y',
        imageUrl: 'https://x',
      });
    });

    it('defaults optional fields to null', () => {
      const out = ProductMapper.newProductPersistence({
        id: 'p_1',
        title: 'X',
      });
      expect(out.description).toBeNull();
      expect(out.imageUrl).toBeNull();
    });
  });

  describe('newOfferPersistence', () => {
    it('returns the canonical Prisma-shaped bag (rawData coerced to JSON)', () => {
      const out = ProductMapper.newOfferPersistence({
        id: 'o_1',
        productId: 'p_1',
        sourceId: 's_1',
        domainRuleId: null,
        url: 'https://x',
        currency: 'USD',
        price: 19.99,
        rawData: { hello: 'world' },
      });
      expect(out.id).toBe('o_1');
      expect(out.price).toBe(19.99);
      expect(out.rawData).toEqual({ hello: 'world' });
      expect(out.extractedAt).toBeInstanceOf(Date);
    });

    it('uses Prisma.JsonNull for rawData when not provided', () => {
      const out = ProductMapper.newOfferPersistence({
        id: 'o_1',
        productId: 'p_1',
        sourceId: 's_1',
        domainRuleId: null,
        url: 'https://x',
        currency: 'USD',
        price: 0,
      });
      expect(out.rawData).toBe(Prisma.JsonNull);
    });
  });
});

// Touch the `Decimal` and `PrismaProduct` imports so static analysers
// don't flag them as unused when the helper bodies above change.
type _Touches = PrismaProduct | typeof Decimal;
