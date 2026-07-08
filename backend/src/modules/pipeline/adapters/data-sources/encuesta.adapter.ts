import { Injectable, Logger } from '@nestjs/common';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import type { IDataSource, ScrapeResult, SourceConfig } from '../../interfaces';
import { runEncuestaScrape } from '../../pipeline-scripts-bridge';

@Injectable()
export class EncuestaAdapter implements IDataSource {
  readonly source = PipelineSource.ENCUESTA;
  private readonly logger = new Logger(EncuestaAdapter.name);

  async run(config: SourceConfig): Promise<ScrapeResult> {
    this.logger.log(`Cargando encuesta CSV → ${config.outputDir}`);
    return runEncuestaScrape(config);
  }
}
