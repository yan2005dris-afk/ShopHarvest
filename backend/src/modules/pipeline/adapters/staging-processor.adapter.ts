import { Injectable } from '@nestjs/common';
import type {
  IStagingProcessor,
  StagingOptions,
  StagingResult,
} from '../interfaces';
import { StagingProcessorService } from '../etl/staging-processor.service';

/**
 * StagingProcessorAdapter — thin `IStagingProcessor` delegate to the
 * native `StagingProcessorService`. Kept as a separate adapter class
 * (rather than binding the service directly to the token) so the
 * `STAGING_PROCESSOR` token boundary stays swappable, matching the
 * rest of the hexagonal port/adapter layer.
 */
@Injectable()
export class StagingProcessorAdapter implements IStagingProcessor {
  constructor(private readonly staging: StagingProcessorService) {}

  async run(opts?: StagingOptions): Promise<StagingResult> {
    return this.staging.run(opts);
  }
}
