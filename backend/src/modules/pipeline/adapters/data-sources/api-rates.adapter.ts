import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { fetchExchangeRates } from '../../scraping/exchange-rates';

@Injectable()
export class ApiRateAdapter implements IDataSource {
  readonly source = PipelineSource.API_RATES;
  private readonly logger = new Logger(ApiRateAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Iniciando fetch exchange-rates → ${config.outputDir}`);
    return fetchExchangeRates(config);
  }
}
