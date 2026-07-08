import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { scrapeMercadoLibre } from '../../scraping/mercadolibre';

/**
 * MercadoLibreAdapter — IDataSource implementation that calls into
 * the legacy `scripts/scraping/mercadolibre.ts` via the bridge.
 *
 * The scraper returns a `ScrapeResult` directly, so this adapter is
 * a thin ID-wrapping layer. Logger is captured here rather than in
 * the script for NestJS-native log routing.
 */
@Injectable()
export class MercadoLibreAdapter implements IDataSource {
  readonly source = PipelineSource.MERCADOLIBRE;
  private readonly logger = new Logger(MercadoLibreAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando scrape MercadoLibre → ${config.outputDir}`);
    return scrapeMercadoLibre(config);
  }
}
