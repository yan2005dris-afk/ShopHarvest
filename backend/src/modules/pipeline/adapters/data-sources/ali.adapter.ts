import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { BrowserFactoryService } from '../../scraping/browser-factory.service';
import { scrapeAliExpress } from '../../scraping/aliexpress';

/**
 * AliExpressAdapter — native IDataSource implementation that runs
 * the Playwright scraper against aliexpress.com via BrowserFactoryService.
 *
 * The adapter is a thin layer: it injects BrowserFactoryService and
 * ConfigService (so the scraper can read PIPELINE_RAW_DIR), then
 * delegates to scrapeAliExpress(). The scraper handles browser
 * lifecycle, region redirect, lazy-load, retry with backoff, metrics,
 * and raw JSON persistence.
 */
@Injectable()
export class AliExpressAdapter implements IDataSource {
  readonly source = PipelineSource.ALIEXPRESS;
  private readonly logger = new Logger(AliExpressAdapter.name);

  constructor(
    private readonly browserFactory: BrowserFactoryService,
    private readonly configService: ConfigService,
  ) {}

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando scrape AliExpress → ${config.outputDir}`);
    const result = await scrapeAliExpress(
      config,
      this.browserFactory,
      this.configService,
    );
    if (result.totalScraped === 0) {
      this.logger.warn('ali: 0 items extracted');
      if (result.metrics) {
        result.metrics.state = 'failed';
      }
    }
    return result;
  }
}
