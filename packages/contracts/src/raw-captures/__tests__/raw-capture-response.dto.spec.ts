import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { RawCaptureResponseDto } from '../raw-capture-response.dto';

describe('RawCaptureResponseDto (@Expose whitelist)', () => {
  it('exposes decorated fields and strips non-decorated ones', () => {
    const raw = {
      offerId: 'offer-1',
      sourceId: 'src-1',
      payload: { price: 19.99 },
      capturedAt: '2026-01-01T00:00:00.000Z',
      internalBatchId: 'should-not-leak',
    };
    const dto = plainToInstance(RawCaptureResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as unknown as Record<string, unknown>;

    expect(dto.offerId).toBe('offer-1');
    expect(dto.sourceId).toBe('src-1');
    expect(dto.payload).toEqual({ price: 19.99 });
    expect(dto).not.toHaveProperty('internalBatchId');
  });
});
