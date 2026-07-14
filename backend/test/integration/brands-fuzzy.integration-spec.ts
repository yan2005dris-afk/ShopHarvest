import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { OperationalPrismaService } from '../../src/common/prisma/operational-prisma.service';
import { FuzzyMatchBrandsUseCase } from '../../src/modules/operational/brands/application/fuzzy-match-brands.use-case';

/**
 * Cambio SDD: products-hexagonal. BrandsService was retired when the brands
 * module was migrated to hexagonal; this integration test was updated to
 * exercise the new public API (FuzzyMatchBrandsUseCase) and to use
 * OperationalPrismaService directly for seed/cleanup.
 */
describe('Brands — Fuzzy Matching (integration)', () => {
  let app: INestApplication;
  let fuzzyMatchUseCase: FuzzyMatchBrandsUseCase;
  let prisma: OperationalPrismaService;

  const seedNames = ['Samsung', 'Samsong', 'Sony', 'Philips', 'Apple'];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    fuzzyMatchUseCase = moduleFixture.get(FuzzyMatchBrandsUseCase);
    prisma = moduleFixture.get(OperationalPrismaService);

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

  afterAll(async () => {
    await prisma.brand.deleteMany({
      where: { name: { in: seedNames } },
    });
    await app.close();
  });

  it('returns exact match with similarity = 1.0 and lowConfidence = false', async () => {
    const results = await fuzzyMatchUseCase.execute({
      query: 'Samsung',
      threshold: 0.6,
    });
    const exact = results.find((r) => r.brand.name === 'Samsung');

    expect(exact).toBeDefined();
    expect(exact!.similarity).toBe(1.0);
    expect(exact!.lowConfidence).toBe(false);
  });

  it('returns close fuzzy match with high similarity', async () => {
    const results = await fuzzyMatchUseCase.execute({
      query: 'Samsung',
      threshold: 0.6,
    });
    const close = results.find((r) => r.brand.name === 'Samsong');

    // Samsong is a close typo of Samsung — should match but with similarity < 1.0
    expect(close).toBeDefined();
    expect(close!.similarity).toBeGreaterThan(0.6);
    expect(close!.similarity).toBeLessThan(1.0);
  });

  it('returns empty array for completely unrelated query', async () => {
    const results = await fuzzyMatchUseCase.execute({
      query: 'zxcvbnm',
      threshold: 0.6,
    });
    expect(results).toHaveLength(0);
  });

  it('returns results sorted by similarity descending', async () => {
    const results = await fuzzyMatchUseCase.execute({
      query: 'Samsung',
      threshold: 0.6,
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i].similarity).toBeLessThanOrEqual(
        results[i - 1].similarity,
      );
    }
  });

  it('flags results with similarity between 0.6 and 0.75 as lowConfidence', async () => {
    const results = await fuzzyMatchUseCase.execute({
      query: 'Samsung',
      threshold: 0.6,
    });
    const lowConfidenceResults = results.filter((r) => r.lowConfidence);

    // All low-confidence results should have similarity in range (0.6, 0.75)
    for (const r of lowConfidenceResults) {
      expect(r.similarity).toBeGreaterThan(0.6);
      expect(r.similarity).toBeLessThan(0.75);
    }
  });

  it('returns empty array for empty query', async () => {
    const results = await fuzzyMatchUseCase.execute({
      query: '',
      threshold: 0.6,
    });
    expect(results).toHaveLength(0);
  });

  it('respects custom threshold parameter', async () => {
    // With threshold 0.8, only very close matches should return
    const results = await fuzzyMatchUseCase.execute({
      query: 'Samsung',
      threshold: 0.8,
    });
    const samsung = results.find((r) => r.brand.name === 'Samsung');
    expect(samsung).toBeDefined();

    // Samsong should not appear at this threshold
    const samsong = results.find((r) => r.brand.name === 'Samsong');
    expect(samsong).toBeUndefined();
  });
});
