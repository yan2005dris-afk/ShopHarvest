import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { runTemuScrape } from '../../pipeline-scripts-bridge';

@Injectable()
export class TemuAdapter implements IDataSource {
  readonly source = PipelineSource.TEMU;
  private readonly logger = new Logger(TemuAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando scrape Temu → ${config.outputDir}`);
    return runTemuScrape(config);
  }
}
