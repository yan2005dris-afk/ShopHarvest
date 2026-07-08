import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { runCsvScrape } from '../../pipeline-scripts-bridge';

@Injectable()
export class CsvAdapter implements IDataSource {
  readonly source = PipelineSource.CSV_DATASET;
  private readonly logger = new Logger(CsvAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Cargando CSV dataset → ${config.outputDir}`);
    return runCsvScrape(config);
  }
}
