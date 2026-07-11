import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class IngestRawCaptureDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  @IsNotEmpty()
  offerId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  payload!: Record<string, unknown>;
}
