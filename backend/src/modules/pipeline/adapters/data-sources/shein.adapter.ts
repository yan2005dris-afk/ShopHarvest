import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { readSheinExtensionExport } from '../../scraping/shein';

@Injectable()
export class SheinAdapter implements IDataSource {
  readonly source = PipelineSource.SHEIN;
  private readonly logger = new Logger(SheinAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    void config;
    // EXTENSION_EXPORT_PATH is resolved from process.env for PR 1b. PR 5
    // wires ConfigService injection and zod-validated extension export here.
    const exportPath =
      process.env['EXTENSION_EXPORT_PATH'] ??
      'backend/pipeline/extension/extension_export.json';
    this.logger.log(`Leyendo export de extensión Shein → ${exportPath}`);
    return readSheinExtensionExport(exportPath);
  }
}
