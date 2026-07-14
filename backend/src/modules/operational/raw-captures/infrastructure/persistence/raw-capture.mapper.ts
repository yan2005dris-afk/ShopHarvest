import type { RawCapture as PrismaRawCapture } from '../../../../../generated/operational';
import { RawCapture } from '../../domain/raw-capture.entity';
import type { RawCaptureProps } from '../../domain/raw-capture.entity';

export class RawCaptureMapper {
  static toDomain(row: PrismaRawCapture): RawCapture {
    const props: RawCaptureProps = {
      offerId: row.offerId,
      sourceId: row.sourceId,
      payload: row.payload as unknown as Record<string, unknown>,
      capturedAt: row.capturedAt,
      status: row.status,
      attempts: row.attempts,
    };
    return RawCapture.fromPersistence(props);
  }

  static toPersistence(capture: RawCapture): RawCaptureProps {
    return capture.toJSON();
  }
}
