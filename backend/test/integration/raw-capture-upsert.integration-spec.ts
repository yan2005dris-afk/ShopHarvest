import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { OperationalPrismaService } from '../../src/common/prisma/operational-prisma.service';
import {
  DeleteRawCaptureUseCase,
  FindRawCaptureUseCase,
  ListRawCapturesUseCase,
  UpsertRawCaptureUseCase,
} from '../../src/modules/operational/raw-captures';
import { CreateSourceUseCase } from '../../src/modules/operational/sources';

describe('RawCapture Upsert (integration)', () => {
  let app: INestApplication;
  let prisma: OperationalPrismaService;
  let upsertRawCapture: UpsertRawCaptureUseCase;
  let findRawCapture: FindRawCaptureUseCase;
  let listRawCaptures: ListRawCapturesUseCase;
  let deleteRawCapture: DeleteRawCaptureUseCase;
  let createSource: CreateSourceUseCase;

  let sourceId1: string;
  let sourceId2: string;
  const offerId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(OperationalPrismaService);
    upsertRawCapture = moduleFixture.get(UpsertRawCaptureUseCase);
    findRawCapture = moduleFixture.get(FindRawCaptureUseCase);
    listRawCaptures = moduleFixture.get(ListRawCapturesUseCase);
    deleteRawCapture = moduleFixture.get(DeleteRawCaptureUseCase);
    createSource = moduleFixture.get(CreateSourceUseCase);

    const src1 = await createSource.execute({
      code: 'FUZZY_TEST_SRC_1',
      name: 'Fuzzy Test Source 1',
      baseUrl: 'https://test1.example.com',
    });
    sourceId1 = src1.id;

    const src2 = await createSource.execute({
      code: 'FUZZY_TEST_SRC_2',
      name: 'Fuzzy Test Source 2',
      baseUrl: 'https://test2.example.com',
    });
    sourceId2 = src2.id;

    const product = await prisma.product.create({
      data: {
        title: 'Test Integration Product',
      },
    });

    await prisma.offer.create({
      data: {
        id: offerId,
        productId: product.id,
        sourceId: sourceId1,
        url: 'https://test1.example.com/product-1',
        price: 99.99,
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.rawCapture.delete({
        where: {
          offerId_sourceId: { offerId, sourceId: sourceId1 },
        },
      });
    } catch {
      await Promise.resolve();
    }
    try {
      await prisma.rawCapture.delete({
        where: {
          offerId_sourceId: { offerId, sourceId: sourceId2 },
        },
      });
    } catch {
      await Promise.resolve();
    }

    try {
      await prisma.offer.delete({ where: { id: offerId } });
    } catch {
      await Promise.resolve();
    }

    try {
      await prisma.product.deleteMany({
        where: { title: 'Test Integration Product' },
      });
    } catch {
      await Promise.resolve();
    }

    try {
      await prisma.source.delete({ where: { id: sourceId1 } });
    } catch {
      await Promise.resolve();
    }
    try {
      await prisma.source.delete({ where: { id: sourceId2 } });
    } catch {
      await Promise.resolve();
    }

    await app.close();
  });

  it('creates a raw capture on first upsert', async () => {
    const result = await upsertRawCapture.execute({
      offerId,
      sourceId: sourceId1,
      payload: { title: 'Test Product', price: 99.99 },
    });

    expect(result.offerId).toBe(offerId);
    expect(result.sourceId).toBe(sourceId1);
    expect(result.payload).toEqual({ title: 'Test Product', price: 99.99 });
  });

  it('overwrites payload on re-scrape of same offerId+sourceId', async () => {
    const updated = await upsertRawCapture.execute({
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
    const capture1 = await upsertRawCapture.execute({
      offerId,
      sourceId: sourceId2,
      payload: { title: 'Different Source', price: 49.99 },
    });

    expect(capture1.offerId).toBe(offerId);
    expect(capture1.sourceId).toBe(sourceId2);

    const capture2 = await findRawCapture.execute(offerId, sourceId1);
    expect(capture2.payload).toEqual({
      title: 'Updated Product',
      price: 79.99,
      stock: true,
    });
  });

  it('finds a raw capture by composite key', async () => {
    const found = await findRawCapture.execute(offerId, sourceId1);
    expect(found.offerId).toBe(offerId);
    expect(found.sourceId).toBe(sourceId1);
  });

  it('lists raw captures filtered by sourceId', async () => {
    const list = await listRawCaptures.execute(sourceId1);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((capture) => capture.sourceId === sourceId1)).toBe(true);
  });

  it('throws for a nonexistent capture', async () => {
    const fakeOfferId = '00000000-0000-0000-0000-000000009999';
    await expect(
      findRawCapture.execute(fakeOfferId, sourceId1),
    ).rejects.toThrow();
  });

  it('deletes a raw capture', async () => {
    await deleteRawCapture.execute(offerId, sourceId2);
    await expect(findRawCapture.execute(offerId, sourceId2)).rejects.toThrow();
  });
});
