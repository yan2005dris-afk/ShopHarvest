import { Injectable, Logger } from '@nestjs/common';
import type {
  IStagingProcessor,
  StagingOptions,
  StagingResult,
} from '../interfaces';

/**
 * StagingProcessorAdapter — placeholder until PR 6 wires the native
 * `StagingProcessorService` via the `STAGING_PROCESSOR` DI token. The
 * service reads raw JSON from `PIPELINE_RAW_DIR/<source>/<ts>.json`
 * and writes staging rows to `PIPELINE_STAGING_DIR/<source>/<ts>.json`.
 *
 * For PR 1b the adapter keeps its `IStagingProcessor` contract and
 * throws "see PR 6" — the build stays green, DI bindings resolve, and
 * callers see the documented error instead of a runtime crash.
 */
@Injectable()
export class StagingProcessorAdapter implements IStagingProcessor {
  private readonly logger = new Logger(StagingProcessorAdapter.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(opts?: StagingOptions): Promise<StagingResult> {
    void opts;
    this.logger.warn(
      'StagingProcessorAdapter: native StagingProcessorService not wired yet; see PR 6 (etl-staging-dw-native)',
    );
    throw new Error(
      'staging-processor: not implemented yet; see PR 6 (etl-staging-dw-native)',
    );
  }
}
