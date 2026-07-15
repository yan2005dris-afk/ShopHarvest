import { Offer } from './offer.entity';
import { PriceObservation } from './price-observation.entity';
import { Product } from './product.entity';
import type {
  CreateProductInput,
  ProductProps,
  UpdateProductInput,
} from './product.entity';
import type { UpdateOfferInput, CreateOfferInput } from './offer.entity';
import type { CreatePriceObservationInput } from './price-observation.entity';

const baseProduct: CreateProductInput = {
  id: 'p_1',
  title: 'Wireless Earbuds',
};

const buildOffer = (overrides: Partial<CreateOfferInput> = {}) =>
  Offer.create({
    id: 'o_1',
    productId: 'p_1',
    sourceId: 's_1',
    domainRuleId: null,
    url: 'https://temu.com/x',
    currency: 'USD',
    price: 19.99,
    ...overrides,
  });

const buildObservation = (
  overrides: Partial<CreatePriceObservationInput> = {},
) =>
  PriceObservation.create({
    id: 'po_1',
    offerId: 'o_1',
    price: 19.99,
    currency: 'USD',
    ...overrides,
  });

describe('Product entity', () => {
  describe('create()', () => {
    it('creates a Product with default null optional fields and empty offers', () => {
      const product = Product.create(
        baseProduct,
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(product.id).toBe('p_1');
      expect(product.title).toBe('Wireless Earbuds');
      expect(product.description).toBeNull();
      expect(product.imageUrl).toBeNull();
      expect(product.categoryId).toBeNull();
      expect(product.brandId).toBeNull();
      expect(product.offers).toEqual([]);
      expect(product.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(product.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('preserves every optional field on create', () => {
      const product = Product.create({
        id: 'p_2',
        title: 'Camisa',
        description: 'Algodón',
        imageUrl: 'https://shop.com/x.jpg',
        categoryId: 'cat_x',
        brandId: 'brand_y',
      });
      expect(product.description).toBe('Algodón');
      expect(product.imageUrl).toBe('https://shop.com/x.jpg');
      expect(product.categoryId).toBe('cat_x');
      expect(product.brandId).toBe('brand_y');
    });
  });

  describe('update()', () => {
    it('updates fields and bumps updatedAt when something changed', () => {
      const product = Product.create(
        baseProduct,
        new Date('2026-01-01T00:00:00Z'),
      );
      product.update(
        { title: 'Renamed', description: 'New desc' },
        new Date('2026-02-01T00:00:00Z'),
      );
      expect(product.title).toBe('Renamed');
      expect(product.description).toBe('New desc');
      expect(product.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('treats undefined fields as no-ops', () => {
      const product = Product.create(
        { ...baseProduct, description: 'keep me' },
        new Date('2026-01-01T00:00:00Z'),
      );
      product.update({ title: 'Renamed' });
      expect(product.description).toBe('keep me');
    });

    it('nulls a field when explicitly passed as null', () => {
      const product = Product.create(
        { ...baseProduct, description: 'x', categoryId: 'cat_a' },
        new Date('2026-01-01T00:00:00Z'),
      );
      product.update({ description: null, categoryId: null });
      expect(product.description).toBeNull();
      expect(product.categoryId).toBeNull();
    });

    it('does not bump updatedAt when no field actually changed', () => {
      const product = Product.create(
        baseProduct,
        new Date('2026-01-01T00:00:00Z'),
      );
      const before = product.updatedAt;
      product.update({ title: 'Wireless Earbuds' });
      expect(product.updatedAt).toBe(before);
    });
  });

  describe('toJSON()', () => {
    it('returns the props and exposes the offers collection', () => {
      const product = Product.create(baseProduct);
      const offer = buildOffer();
      product.offers.push(offer);
      const snap = product.toJSON();
      const reloaded = Product.fromPersistence(snap as ProductProps);
      expect(reloaded.id).toBe('p_1');
      expect(reloaded.title).toBe('Wireless Earbuds');
      expect(reloaded.offers).toHaveLength(1);
      expect(reloaded.offers[0].id).toBe('o_1');
    });
  });
});

describe('Offer entity', () => {
  describe('create()', () => {
    it('creates an Offer with the canonical field shape', () => {
      const offer = buildOffer({ sku: 'SKU-1' });
      expect(offer.productId).toBe('p_1');
      expect(offer.sourceId).toBe('s_1');
      expect(offer.url).toBe('https://temu.com/x');
      expect(offer.currency).toBe('USD');
      expect(offer.price).toBe(19.99);
      expect(offer.sku).toBe('SKU-1');
      expect(offer.rawData).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('updates fields and refreshes extractedAt', () => {
      const offer = buildOffer({ extractedAt: new Date('2026-01-01') });
      const update: UpdateOfferInput = {
        price: 12.5,
        sku: 'SKU-2',
        rawData: { hello: 'world' },
      };
      offer.refresh(update, new Date('2026-02-01T00:00:00Z'));
      expect(offer.price).toBe(12.5);
      expect(offer.sku).toBe('SKU-2');
      expect(offer.rawData).toEqual({ hello: 'world' });
      expect(offer.extractedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('nulls rawData when explicitly passed null', () => {
      const offer = buildOffer({ rawData: { x: 1 } });
      const update: UpdateOfferInput = { rawData: null };
      offer.refresh(update);
      expect(offer.rawData).toBeNull();
    });
  });
});

describe('PriceObservation entity', () => {
  it('creates with the canonical field shape and defaults to "now"', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const obs = PriceObservation.create(
      { id: 'po_a', offerId: 'o_1', price: 19.99, currency: 'USD' },
      now,
    );
    expect(obs.id).toBe('po_a');
    expect(obs.offerId).toBe('o_1');
    expect(obs.price).toBe(19.99);
    expect(obs.currency).toBe('USD');
    expect(obs.observedAt).toEqual(now);
    expect(obs.createdAt).toEqual(now);
  });

  it('accepts an explicit observedAt override', () => {
    const observed = new Date('2026-03-01T00:00:00Z');
    const created = new Date('2026-03-02T00:00:00Z');
    const obs = PriceObservation.create({
      id: 'po_b',
      offerId: 'o_1',
      price: 5,
      currency: 'EUR',
      observedAt: observed,
      createdAt: created,
    });
    expect(obs.observedAt).toEqual(observed);
    expect(obs.createdAt).toEqual(created);
  });

  it('round-trips through fromPersistence', () => {
    const obs = buildObservation();
    const reloaded = PriceObservation.fromPersistence(obs.toJSON());
    expect(reloaded.id).toBe('po_1');
    expect(reloaded.offerId).toBe('o_1');
  });
});
