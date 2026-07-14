import { Inject, Injectable } from '@nestjs/common';
import { RawCapture } from '../domain/raw-capture.entity';
import {
  RawCaptureOfferNotFoundError,
  RawCaptureSourceNotFoundError,
} from '../domain/raw-capture.errors';
import { RAW_CAPTURES_REPOSITORY } from '../domain/raw-captures.repository';
import type { RawCapturesRepository } from '../domain/raw-captures.repository';

export interface UpsertRawCaptureCommand {
  offerId: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class UpsertRawCaptureUseCase {
  constructor(
    @Inject(RAW_CAPTURES_REPOSITORY)
    private readonly repository: RawCapturesRepository,
  ) {}

  async execute(command: UpsertRawCaptureCommand): Promise<RawCapture> {
    if (!(await this.repository.sourceExists(command.sourceId))) {
      throw new RawCaptureSourceNotFoundError(command.sourceId);
    }
    if (!(await this.repository.offerExists(command.offerId))) {
      throw new RawCaptureOfferNotFoundError(command.offerId);
    }

    const existing = await this.repository.findByKey(
      command.offerId,
      command.sourceId,
    );
    const capture = existing ?? RawCapture.create(command);
    if (existing) {
      existing.refresh(command.payload);
    }
    return this.repository.save(capture);
  }
}
