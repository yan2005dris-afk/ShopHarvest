import { RawCaptureResponseDto } from '@web-scraping/contracts/raw-captures';
import { RawCapture } from '../../domain/raw-capture.entity';

export class RawCaptureResponseMapper {
  static toDto(capture: RawCapture): RawCaptureResponseDto {
    return {
      offerId: capture.offerId,
      sourceId: capture.sourceId,
      payload: capture.payload,
      capturedAt: capture.capturedAt.toISOString(),
    };
  }
}
