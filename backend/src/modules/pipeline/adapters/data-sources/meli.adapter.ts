import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { BrowserFactoryService } from '../../scraping/browser-factory.service';
import { scrapeMercadoLibre } from '../../scraping/mercadolibre';

/**
 * MercadoLibreAdapter — native IDataSource implementation that runs
 * the Playwright scraper against mercadolibre.com.ec via BrowserFactoryService.
 *
 * The adapter is a thin layer: it injects BrowserFactoryService and
 * ConfigService (so the scraper can read PIPELINE_RAW_DIR), then
 * delegates to scrapeMercadoLibre(). The scraper handles browser
 * lifecycle, retry with backoff, metrics, and raw JSON persistence.
 */
@Injectable()
export class MercadoLibreAdapter implements IDataSource {
  readonly source = PipelineSource.MERCADOLIBRE;
  private readonly logger = new Logger(MercadoLibreAdapter.name);

  constructor(
    private readonly browserFactory: BrowserFactoryService,
    private readonly configService: ConfigService,
  ) {}

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando scrape MercadoLibre → ${config.outputDir}`);
    const result = await scrapeMercadoLibre(
      config,
      this.browserFactory,
      this.configService,
    );
    if (result.totalScraped === 0) {
      this.logger.warn('meli: 0 items extracted');
      if (result.metrics) {
        result.metrics.state = 'failed';
      }
    }
    return result;
  }
}
