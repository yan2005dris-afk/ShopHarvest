import { Inject, Injectable } from '@nestjs/common';
import { RawCaptureNotFoundError } from '../domain/raw-capture.errors';
import { RAW_CAPTURES_REPOSITORY } from '../domain/raw-captures.repository';
import type { RawCapturesRepository } from '../domain/raw-captures.repository';

@Injectable()
export class DeleteRawCaptureUseCase {
  constructor(
    @Inject(RAW_CAPTURES_REPOSITORY)
    private readonly repository: RawCapturesRepository,
  ) {}

  async execute(offerId: string, sourceId: string): Promise<void> {
    const capture = await this.repository.findByKey(offerId, sourceId);
    if (!capture) {
      throw new RawCaptureNotFoundError(offerId, sourceId);
    }
    await this.repository.delete(offerId, sourceId);
  }
}
