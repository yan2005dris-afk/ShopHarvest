import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { readTemuExtensionExport } from '../../scraping/temu';

/**
 * TemuAdapter — native IDataSource implementation that reads
 * `extension_export.json` produced by the Chrome extension. No
 * Playwright, no BrowserFactoryService — extension-based sources
 * never scrape directly (EXT-4, EXT-5).
 */
@Injectable()
export class TemuAdapter implements IDataSource {
  readonly source = PipelineSource.TEMU;
  private readonly logger = new Logger(TemuAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Leyendo export de extensión Temu → ${config.outputDir}`);
    const result = await readTemuExtensionExport(config, this.configService);
    if (result.totalScraped === 0) {
      this.logger.warn('temu: 0 items extracted');
      if (result.metrics) {
        result.metrics.state = 'failed';
      }
    }
    return result;
  }
}
