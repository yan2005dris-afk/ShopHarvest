import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { BrandsService } from '../../src/modules/brands/brands.service';

describe('Brands — Fuzzy Matching (integration)', () => {
  let app: INestApplication;
  let brandsService: BrandsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    brandsService = moduleFixture.get(BrandsService);
  });

  afterAll(async () => {
    // Cleanup test data
    const prisma = (brandsService as any).prisma;
    await prisma.brand.deleteMany({
      where: { name: { in: ['Samsung', 'Samsong', 'Sony', 'Philips', 'Apple'] } },
    });
    await app.close();
  });

  beforeAll(async () => {
    // Seed test brands
    const prisma = (brandsService as any).prisma;
    await prisma.brand.createMany({
      data: [
        { name: 'Samsung', aliases: ['Sam', 'SSG'] },
        { name: 'Samsong', aliases: ['S-Song'] },
        { name: 'Sony', aliases: ['Sony Corp'] },
        { name: 'Philips', aliases: ['PHL'] },
        { name: 'Apple', aliases: ['AAPL'] },
      ],
    });
  });

  it('returns exact match with similarity = 1.0 and lowConfidence = false', async () => {
    const results = await brandsService.fuzzyMatch('Samsung');
    const exact = results.find((r) => r.brand.name === 'Samsung');

    expect(exact).toBeDefined();
    expect(exact!.similarity).toBe(1.0);
    expect(exact!.lowConfidence).toBe(false);
  });

  it('returns close fuzzy match with high similarity', async () => {
    const results = await brandsService.fuzzyMatch('Samsung');
    const close = results.find((r) => r.brand.name === 'Samsong');

    // Samsong is a close typo of Samsung — should match but with similarity < 1.0
    expect(close).toBeDefined();
    expect(close!.similarity).toBeGreaterThan(0.6);
    expect(close!.similarity).toBeLessThan(1.0);
  });

  it('returns empty array for completely unrelated query', async () => {
    const results = await brandsService.fuzzyMatch('zxcvbnm');
    expect(results).toHaveLength(0);
  });

  it('returns results sorted by similarity descending', async () => {
    const results = await brandsService.fuzzyMatch('Samsung');

    for (let i = 1; i < results.length; i++) {
      expect(results[i].similarity).toBeLessThanOrEqual(
        results[i - 1].similarity,
      );
    }
  });

  it('flags results with similarity between 0.6 and 0.75 as lowConfidence', async () => {
    const results = await brandsService.fuzzyMatch('Samsung');
    const lowConfidenceResults = results.filter((r) => r.lowConfidence);

    // All low-confidence results should have similarity in range (0.6, 0.75)
    for (const r of lowConfidenceResults) {
      expect(r.similarity).toBeGreaterThan(0.6);
      expect(r.similarity).toBeLessThan(0.75);
    }
  });

  it('returns empty array for empty query', async () => {
    const results = await brandsService.fuzzyMatch('');
    expect(results).toHaveLength(0);
  });

  it('respects custom threshold parameter', async () => {
    // With threshold 0.8, only very close matches should return
    const results = await brandsService.fuzzyMatch('Samsung', 0.8);
    const samsung = results.find((r) => r.brand.name === 'Samsung');
    expect(samsung).toBeDefined();

    // Samsong should not appear at this threshold
    const samsong = results.find((r) => r.brand.name === 'Samsong');
    expect(samsong).toBeUndefined();
  });
});
