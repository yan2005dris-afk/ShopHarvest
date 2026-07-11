/**
 * Real-target probe for the MercadoLibre scraper (MELI-7).
 *
 * Runs `scrapeMercadoLibre` against the live `mercadolibre.com.ec`
 * site and asserts `totalScraped > 0`. Gated behind `MELI_PROBE_TOKEN`
 * so it never fires by accident (CI, `pnpm test`, etc.) — this hits a
 * real third-party site and is meant for manual verification only.
 *
 * Usage:
 *   MELI_PROBE_TOKEN=1 PIPELINE_RAW_DIR=/tmp/meli-probe \
 *     pnpm --filter backend exec ts-node scripts/probe-meli.ts
 */
import { ConfigService } from '@nestjs/config';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { BrowserFactoryService } from '../src/modules/pipeline/scraping/browser-factory.service';
import { scrapeMercadoLibre } from '../src/modules/pipeline/scraping/mercadolibre';

async function main(): Promise<void> {
  if (!process.env.MELI_PROBE_TOKEN) {
    console.error(
      'probe-meli: refusing to run — set MELI_PROBE_TOKEN to confirm ' +
        'you intend to hit the real mercadolibre.com.ec target.',
    );
    process.exitCode = 1;
    return;
  }

  const configService = new ConfigService();
  const browserFactory = new BrowserFactoryService(configService);

  const result = await scrapeMercadoLibre(
    { source: PipelineSource.MERCADOLIBRE, outputDir: 'probe/meli' },
    browserFactory,
    configService,
  );

  console.log(
    `probe-meli: items=${result.totalScraped} durationMs=${result.durationMs} ` +
      `errors=${result.errors.length} outputPath=${result.outputPath}`,
  );

  if (result.totalScraped === 0) {
    console.error('probe-meli: 0 items extracted — probe failed.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('probe-meli: fatal', err);
  process.exitCode = 1;
});
