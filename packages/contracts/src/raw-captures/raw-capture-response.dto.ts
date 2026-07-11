import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RawCaptureResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  offerId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  sourceId!: string;

  @ApiProperty({ type: Object })
  @Expose()
  payload!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  capturedAt!: string;
}
