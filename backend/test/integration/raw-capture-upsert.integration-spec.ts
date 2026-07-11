import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { RawCapturesService } from '../../src/modules/raw-captures/raw-captures.service';
import { SourcesService } from '../../src/modules/sources/sources.service';

describe('RawCapture Upsert (integration)', () => {
  let app: INestApplication;
  let rawCapturesService: RawCapturesService;
  let sourcesService: SourcesService;

  let sourceId1: string;
  let sourceId2: string;
  const offerId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    rawCapturesService = moduleFixture.get(RawCapturesService);
    sourcesService = moduleFixture.get(SourcesService);

    // Create test sources
    const src1 = await sourcesService.create({
      code: 'FUZZY_TEST_SRC_1',
      name: 'Fuzzy Test Source 1',
      baseUrl: 'https://test1.example.com',
    });
    sourceId1 = src1.id;

    const src2 = await sourcesService.create({
      code: 'FUZZY_TEST_SRC_2',
      name: 'Fuzzy Test Source 2',
      baseUrl: 'https://test2.example.com',
    });
    sourceId2 = src2.id;
  });

  afterAll(async () => {
    // Cleanup test data
    const prisma = (rawCapturesService as any).prisma;

    // Delete raw captures first
    try {
      await prisma.rawCapture.delete({
        where: {
          offerId_sourceId: { offerId, sourceId: sourceId1 },
        },
      });
    } catch { /* ignore */ }
    try {
      await prisma.rawCapture.delete({
        where: {
          offerId_sourceId: { offerId, sourceId: sourceId2 },
        },
      });
    } catch { /* ignore */ }

    // Delete sources
    try {
      await prisma.source.delete({ where: { id: sourceId1 } });
    } catch { /* ignore */ }
    try {
      await prisma.source.delete({ where: { id: sourceId2 } });
    } catch { /* ignore */ }

    await app.close();
  });

  it('creates a raw capture on first upsert', async () => {
    const result = await rawCapturesService.upsert({
      offerId,
      sourceId: sourceId1,
      payload: { title: 'Test Product', price: 99.99 },
    });

    expect(result.offerId).toBe(offerId);
    expect(result.sourceId).toBe(sourceId1);
    expect(result.payload).toEqual({ title: 'Test Product', price: 99.99 });
  });

  it('overwrites payload on re-scrape of same offerId+sourceId', async () => {
    const updated = await rawCapturesService.upsert({
      offerId,
      sourceId: sourceId1,
      payload: { title: 'Updated Product', price: 79.99, stock: true },
    });

    expect(updated.offerId).toBe(offerId);
    expect(updated.sourceId).toBe(sourceId1);
    expect(updated.payload).toEqual({
      title: 'Updated Product',
      price: 79.99,
      stock: true,
    });
  });

  it('keeps different sourceIds independent for the same offerId', async () => {
    const capture1 = await rawCapturesService.upsert({
      offerId,
      sourceId: sourceId2,
      payload: { title: 'Different Source', price: 49.99 },
    });

    expect(capture1.offerId).toBe(offerId);
    expect(capture1.sourceId).toBe(sourceId2);

    // Verify source1 still has the updated payload
    const capture2 = await rawCapturesService.findOne(offerId, sourceId1);
    expect(capture2.payload).toEqual({
      title: 'Updated Product',
      price: 79.99,
      stock: true,
    });
  });

  it('finds a raw capture by composite key', async () => {
    const found = await rawCapturesService.findOne(offerId, sourceId1);
    expect(found.offerId).toBe(offerId);
    expect(found.sourceId).toBe(sourceId1);
  });

  it('lists raw captures filtered by sourceId', async () => {
    const list = await rawCapturesService.findAll(sourceId1);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((r) => r.sourceId === sourceId1)).toBe(true);
  });

  it('throws NotFoundException for nonexistent capture', async () => {
    const fakeOfferId = '00000000-0000-0000-0000-000000009999';
    await expect(
      rawCapturesService.findOne(fakeOfferId, sourceId1),
    ).rejects.toThrow();
  });

  it('deletes a raw capture', async () => {
    // We created sourceId2 capture — delete and verify
    await rawCapturesService.remove(offerId, sourceId2);
    await expect(
      rawCapturesService.findOne(offerId, sourceId2),
    ).rejects.toThrow();
  });
});
