import { Inject, Injectable } from '@nestjs/common';
import { RawCapture } from '../domain/raw-capture.entity';
import { RawCaptureNotFoundError } from '../domain/raw-capture.errors';
import { RAW_CAPTURES_REPOSITORY } from '../domain/raw-captures.repository';
import type { RawCapturesRepository } from '../domain/raw-captures.repository';

@Injectable()
export class FindRawCaptureUseCase {
  constructor(
    @Inject(RAW_CAPTURES_REPOSITORY)
    private readonly repository: RawCapturesRepository,
  ) {}

  async execute(offerId: string, sourceId: string): Promise<RawCapture> {
    const capture = await this.repository.findByKey(offerId, sourceId);
    if (!capture) {
      throw new RawCaptureNotFoundError(offerId, sourceId);
    }
    return capture;
  }
}
