import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { runSheinScrape } from '../../pipeline-scripts-bridge';

@Injectable()
export class SheinAdapter implements IDataSource {
  readonly source = PipelineSource.SHEIN;
  private readonly logger = new Logger(SheinAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando scrape Shein → ${config.outputDir}`);
    return runSheinScrape(config);
  }
}
