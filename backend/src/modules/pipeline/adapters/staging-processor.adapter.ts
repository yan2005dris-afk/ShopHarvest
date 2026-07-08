import { Injectable, Logger } from '@nestjs/common';
import type { IStagingProcessor, StagingOptions, StagingResult } from '../interfaces';
import { runStagingScript } from '../pipeline-scripts-bridge';

/**
 * StagingProcessorAdapter — delegates to runStaging() from the legacy
 * `scripts/staging/run_all.ts`. The script has no playwright/axios
 * deps — only fs/path — so this could be a static import, but we
 * keep the bridge pattern uniform across all adapters.
 */
@Injectable()
export class StagingProcessorAdapter implements IStagingProcessor {
  private readonly logger = new Logger(StagingProcessorAdapter.name);

  async run(opts?: StagingOptions): Promise<StagingResult> {
    this.logger.log('Iniciando staging raw→staging...');
    return runStagingScript(opts);
  }
}
