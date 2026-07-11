import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { readSheinExtensionExport } from '../../scraping/shein';

/**
 * SheinAdapter — native IDataSource implementation that reads
 * `extension_export.json` produced by the Chrome extension. No
 * Playwright, no BrowserFactoryService — extension-based sources
 * never scrape directly (EXT-4, EXT-5).
 */
@Injectable()
export class SheinAdapter implements IDataSource {
  readonly source = PipelineSource.SHEIN;
  private readonly logger = new Logger(SheinAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Leyendo export de extensión Shein → ${config.outputDir}`);
    const result = await readSheinExtensionExport(config, this.configService);
    if (result.totalScraped === 0) {
      this.logger.warn('shein: 0 items extracted');
      if (result.metrics) {
        result.metrics.state = 'failed';
      }
    }
    return result;
  }
}
