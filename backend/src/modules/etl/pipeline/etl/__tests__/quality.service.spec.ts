import { QualityService } from '../quality.service';

describe('QualityService', () => {
  let service: QualityService;

  beforeEach(() => {
    service = new QualityService();
  });

  const VALID_ROW = {
    titulo_oferta: 'Producto de prueba',
    url_producto: 'https://example.com/item-1',
    _fuente: 'mercadolibre',
    precio_usd: 19.99,
    moneda: 'USD',
    categoria_normalizada: 'electronica',
    precio_raw: '19.99',
  };

  it('ETL-3: runs exactly 8 checks and returns state=passed on a clean batch', () => {
    const report = service.run([VALID_ROW]);

    expect(report.checks).toHaveLength(8);
    expect(report.state).toBe('passed');
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it('rate-known fails when a row was converted with a missing FX rate', () => {
    const badRow = { ...VALID_ROW, _rate_missing: true };
    const report = service.run([badRow]);

    expect(report.state).toBe('failed');
    const rateKnown = report.checks.find((c) => c.name === 'rate-known');
    expect(rateKnown?.passed).toBe(false);
    expect(rateKnown?.failures.length).toBeGreaterThan(0);
  });

  it('ETL-4: fails fast — one failed check flips the whole report to failed', () => {
    const badRow = { ...VALID_ROW, titulo_oferta: '' };
    const report = service.run([badRow]);

    expect(report.state).toBe('failed');
    const requiredFields = report.checks.find(
      (c) => c.name === 'required-fields',
    );
    expect(requiredFields?.passed).toBe(false);
    expect(requiredFields?.failures.length).toBeGreaterThan(0);
  });

  it('aggregates every failing check, not just the first', () => {
    const badRow = {
      titulo_oferta: '',
      url_producto: 'not-a-url',
      _fuente: 'mercadolibre',
      precio_usd: -5,
      moneda: 'XYZ',
      categoria_normalizada: '',
      precio_raw: '5',
    };
    const report = service.run([badRow]);

    const failedNames = report.checks
      .filter((c) => !c.passed)
      .map((c) => c.name);
    expect(failedNames).toEqual(
      expect.arrayContaining([
        'required-fields',
        'price-positive',
        'currency-known',
        'url-well-formed',
        'category-nonempty',
      ]),
    );
  });

  it('staging-row-count fails on an empty batch', () => {
    const report = service.run([]);
    expect(report.state).toBe('failed');
    expect(
      report.checks.find((c) => c.name === 'staging-row-count')?.passed,
    ).toBe(false);
  });

  it('duplicate-product-id fails when two rows share titulo+precio_raw+fuente', () => {
    const report = service.run([VALID_ROW, { ...VALID_ROW }]);
    expect(report.state).toBe('failed');
    expect(
      report.checks.find((c) => c.name === 'duplicate-product-id')?.passed,
    ).toBe(false);
  });
});
