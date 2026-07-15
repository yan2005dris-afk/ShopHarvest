import { Source, UpdateSourceInput } from './source.entity';
import { InvalidSourceStatusTransitionError } from './source.errors';

describe('Source entity', () => {
  const baseCreateInput = {
    id: 'src_1',
    code: 'ML_AR',
    name: 'Mercado Libre Argentina',
    baseUrl: 'https://www.mercadolibre.com.ar',
  };

  describe('create()', () => {
    it('creates a source with inactive status by default', () => {
      const source = Source.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(source.id).toBe('src_1');
      expect(source.code).toBe('ML_AR');
      expect(source.name).toBe('Mercado Libre Argentina');
      expect(source.baseUrl).toBe('https://www.mercadolibre.com.ar');
      expect(source.status).toBe('inactive');
      expect(source.config).toBeNull();
      expect(source.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(source.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('persists optional config on create', () => {
      const source = Source.create(
        { ...baseCreateInput, config: { selector: 'h1' } },
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(source.config).toEqual({ selector: 'h1' });
    });
  });

  describe('transitionStatus()', () => {
    it('allows inactive → active', () => {
      const source = Source.create(baseCreateInput);
      source.transitionStatus('active', new Date('2026-01-02T00:00:00Z'));
      expect(source.status).toBe('active');
      expect(source.updatedAt).toEqual(new Date('2026-01-02T00:00:00Z'));
    });

    it('allows active → error', () => {
      const source = Source.create(baseCreateInput);
      source.transitionStatus('active');
      source.transitionStatus('error');
      expect(source.status).toBe('error');
    });

    it('allows error → inactive (full cycle)', () => {
      const source = Source.create(baseCreateInput);
      source.transitionStatus('active');
      source.transitionStatus('error');
      source.transitionStatus('inactive');
      expect(source.status).toBe('inactive');
    });

    it('rejects inactive → error', () => {
      const source = Source.create(baseCreateInput);
      expect(() => source.transitionStatus('error')).toThrow(
        InvalidSourceStatusTransitionError,
      );
      expect(source.status).toBe('inactive');
    });

    it('rejects active → inactive', () => {
      const source = Source.create(baseCreateInput);
      source.transitionStatus('active');
      expect(() => source.transitionStatus('inactive')).toThrow(
        InvalidSourceStatusTransitionError,
      );
      expect(source.status).toBe('active');
    });

    it('rejects error → active', () => {
      const source = Source.create(baseCreateInput);
      source.transitionStatus('active');
      source.transitionStatus('error');
      expect(() => source.transitionStatus('active')).toThrow(
        InvalidSourceStatusTransitionError,
      );
    });

    it('is a no-op when target status equals current status', () => {
      const source = Source.create(baseCreateInput);
      const before = source.updatedAt;
      source.transitionStatus('inactive');
      expect(source.status).toBe('inactive');
      expect(source.updatedAt).toBe(before);
    });
  });

  describe('update()', () => {
    it('updates name and baseUrl', () => {
      const source = Source.create(baseCreateInput);
      const input: UpdateSourceInput = {
        name: 'ML Argentina',
        baseUrl: 'https://listado.mercadolibre.com.ar',
      };
      source.update(input, new Date('2026-02-01T00:00:00Z'));
      expect(source.name).toBe('ML Argentina');
      expect(source.baseUrl).toBe('https://listado.mercadolibre.com.ar');
      expect(source.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('delegates to transitionStatus when status changes', () => {
      const source = Source.create(baseCreateInput);
      source.update({ status: 'active' });
      expect(source.status).toBe('active');
    });

    it('throws on invalid status transition via update()', () => {
      const source = Source.create(baseCreateInput);
      expect(() => source.update({ status: 'error' })).toThrow(
        InvalidSourceStatusTransitionError,
      );
      expect(source.status).toBe('inactive');
    });

    it('treats undefined config as a no-op (does not null-out config)', () => {
      const source = Source.create({ ...baseCreateInput, config: { a: 1 } });
      source.update({ name: 'New' });
      expect(source.config).toEqual({ a: 1 });
    });

    it('overwrites config when explicitly provided', () => {
      const source = Source.create({ ...baseCreateInput, config: { a: 1 } });
      source.update({ config: { b: 2 } });
      expect(source.config).toEqual({ b: 2 });
    });

    it('nulls out config when explicitly passed as null', () => {
      const source = Source.create({ ...baseCreateInput, config: { a: 1 } });
      source.update({ config: null });
      expect(source.config).toBeNull();
    });
  });

  describe('toJSON()', () => {
    it('returns a shallow copy of the props', () => {
      const source = Source.create(
        baseCreateInput,
        new Date('2026-01-01T00:00:00Z'),
      );
      const json = source.toJSON();
      expect(json).toEqual({
        id: 'src_1',
        code: 'ML_AR',
        name: 'Mercado Libre Argentina',
        baseUrl: 'https://www.mercadolibre.com.ar',
        status: 'inactive',
        config: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
    });
  });
});
