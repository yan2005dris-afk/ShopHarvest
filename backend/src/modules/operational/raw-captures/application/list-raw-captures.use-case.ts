import { Inject, Injectable } from '@nestjs/common';
import { RawCapture } from '../domain/raw-capture.entity';
import { RAW_CAPTURES_REPOSITORY } from '../domain/raw-captures.repository';
import type { RawCapturesRepository } from '../domain/raw-captures.repository';

@Injectable()
export class ListRawCapturesUseCase {
  constructor(
    @Inject(RAW_CAPTURES_REPOSITORY)
    private readonly repository: RawCapturesRepository,
  ) {}

  async execute(sourceId?: string): Promise<RawCapture[]> {
    return this.repository.findAll(sourceId);
  }
}
