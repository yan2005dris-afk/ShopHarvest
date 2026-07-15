import { DeleteRawCaptureUseCase } from './delete-raw-capture.use-case';
import { FindRawCaptureUseCase } from './find-raw-capture.use-case';
import { ListRawCapturesUseCase } from './list-raw-captures.use-case';
import { UpsertRawCaptureUseCase } from './upsert-raw-capture.use-case';
import { RawCapture } from '../domain/raw-capture.entity';
import {
  RawCaptureNotFoundError,
  RawCaptureOfferNotFoundError,
  RawCaptureSourceNotFoundError,
} from '../domain/raw-capture.errors';
import { RawCapturesRepository } from '../domain/raw-captures.repository';

const createRepository = (): jest.Mocked<RawCapturesRepository> => ({
  sourceExists: jest.fn(),
  offerExists: jest.fn(),
  findByKey: jest.fn(),
  findAll: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const createCapture = (): RawCapture =>
  RawCapture.fromPersistence({
    offerId: 'off_001',
    sourceId: 'src_001',
    payload: { price: 100 },
    capturedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'PROCESSED',
    attempts: 2,
  });

describe('UpsertRawCaptureUseCase', () => {
  let useCase: UpsertRawCaptureUseCase;
  let repository: jest.Mocked<RawCapturesRepository>;

  beforeEach(() => {
    repository = createRepository();
    useCase = new UpsertRawCaptureUseCase(repository);
    repository.sourceExists.mockResolvedValue(true);
    repository.offerExists.mockResolvedValue(true);
    repository.findByKey.mockResolvedValue(null);
    repository.save.mockImplementation((capture) => Promise.resolve(capture));
  });

  it('creates and persists an unprocessed raw capture', async () => {
    const result = await useCase.execute({
      offerId: 'off_001',
      sourceId: 'src_001',
      payload: { price: 100, title: 'Test' },
    });

    expect(repository.sourceExists.mock.calls).toEqual([['src_001']]);
    expect(repository.offerExists.mock.calls).toEqual([['off_001']]);
    expect(repository.findByKey.mock.calls).toEqual([['off_001', 'src_001']]);
    expect(repository.save.mock.calls).toHaveLength(1);
    expect(result.offerId).toBe('off_001');
    expect(result.sourceId).toBe('src_001');
    expect(result.payload).toEqual({ price: 100, title: 'Test' });
    expect(result.status).toBe('UNPROCESSED');
    expect(result.attempts).toBe(0);
  });

  it('overwrites an existing capture and resets processing state', async () => {
    const existing = createCapture();
    repository.findByKey.mockResolvedValue(existing);

    const result = await useCase.execute({
      offerId: 'off_001',
      sourceId: 'src_001',
      payload: { price: 90, title: 'Updated' },
    });

    expect(result).toBe(existing);
    expect(result.payload).toEqual({ price: 90, title: 'Updated' });
    expect(result.status).toBe('UNPROCESSED');
    expect(result.attempts).toBe(0);
    expect(result.capturedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00.000Z').getTime(),
    );
  });

  it('does not check the offer when the source does not exist', async () => {
    repository.sourceExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        offerId: 'off_001',
        sourceId: 'missing',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(RawCaptureSourceNotFoundError);

    expect(repository.offerExists.mock.calls).toHaveLength(0);
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('rejects an unknown offer', async () => {
    repository.offerExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        offerId: 'missing',
        sourceId: 'src_001',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(RawCaptureOfferNotFoundError);

    expect(repository.findByKey.mock.calls).toHaveLength(0);
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('accepts an empty object payload', async () => {
    const result = await useCase.execute({
      offerId: 'off_001',
      sourceId: 'src_001',
      payload: {},
    });

    expect(result.payload).toEqual({});
  });
});

describe('FindRawCaptureUseCase', () => {
  it('returns a capture by composite key', async () => {
    const repository = createRepository();
    const capture = createCapture();
    repository.findByKey.mockResolvedValue(capture);
    const useCase = new FindRawCaptureUseCase(repository);

    const result = await useCase.execute('off_001', 'src_001');

    expect(result).toBe(capture);
    expect(repository.findByKey.mock.calls).toEqual([['off_001', 'src_001']]);
  });

  it('throws when the capture does not exist', async () => {
    const repository = createRepository();
    repository.findByKey.mockResolvedValue(null);
    const useCase = new FindRawCaptureUseCase(repository);

    await expect(useCase.execute('missing', 'src_001')).rejects.toBeInstanceOf(
      RawCaptureNotFoundError,
    );
  });
});

describe('ListRawCapturesUseCase', () => {
  it('passes the optional source filter to the repository', async () => {
    const repository = createRepository();
    const capture = createCapture();
    repository.findAll.mockResolvedValue([capture]);
    const useCase = new ListRawCapturesUseCase(repository);

    const result = await useCase.execute('src_001');

    expect(result).toEqual([capture]);
    expect(repository.findAll.mock.calls).toEqual([['src_001']]);
  });
});

describe('DeleteRawCaptureUseCase', () => {
  it('deletes an existing capture', async () => {
    const repository = createRepository();
    repository.findByKey.mockResolvedValue(createCapture());
    const useCase = new DeleteRawCaptureUseCase(repository);

    await useCase.execute('off_001', 'src_001');

    expect(repository.delete.mock.calls).toEqual([['off_001', 'src_001']]);
  });

  it('does not delete a missing capture', async () => {
    const repository = createRepository();
    repository.findByKey.mockResolvedValue(null);
    const useCase = new DeleteRawCaptureUseCase(repository);

    await expect(useCase.execute('missing', 'src_001')).rejects.toBeInstanceOf(
      RawCaptureNotFoundError,
    );
    expect(repository.delete.mock.calls).toHaveLength(0);
  });
});
