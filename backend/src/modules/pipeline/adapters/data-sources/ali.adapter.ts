import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { scrapeAliExpress } from '../../scraping/aliexpress';

@Injectable()
export class AliExpressAdapter implements IDataSource {
  readonly source = PipelineSource.ALIEXPRESS;
  private readonly logger = new Logger(AliExpressAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando scrape AliExpress → ${config.outputDir}`);
    return scrapeAliExpress(config);
  }
}
