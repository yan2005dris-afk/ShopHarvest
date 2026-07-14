/**
 * Real-target probe for the AliExpress scraper (ALI-7).
 *
 * Runs `scrapeAliExpress` against the live `aliexpress.com` site and
 * asserts `totalScraped > 0`. Gated behind `ALI_PROBE_TOKEN` so it
 * never fires by accident (CI, `pnpm test`, etc.) — this hits a real
 * third-party site and is meant for manual verification only.
 *
 * Usage:
 *   ALI_PROBE_TOKEN=1 PIPELINE_RAW_DIR=/tmp/ali-probe \
 *     pnpm --filter backend exec ts-node scripts/probe-ali.ts
 */
import { ConfigService } from '@nestjs/config';
import { PipelineSource } from '@web-scraping/contracts/pipeline';
import { BrowserFactoryService } from '../src/modules/etl/pipeline/scraping/browser-factory.service';
import { scrapeAliExpress } from '../src/modules/etl/pipeline/scraping/aliexpress';

async function main(): Promise<void> {
  if (!process.env.ALI_PROBE_TOKEN) {
    console.error(
      'probe-ali: refusing to run — set ALI_PROBE_TOKEN to confirm ' +
        'you intend to hit the real aliexpress.com target.',
    );
    process.exitCode = 1;
    return;
  }

  const configService = new ConfigService();
  const browserFactory = new BrowserFactoryService(configService);

  const result = await scrapeAliExpress(
    { source: PipelineSource.ALIEXPRESS, outputDir: 'probe/aliexpress' },
    browserFactory,
    configService,
  );

  console.log(
    `probe-ali: items=${result.totalScraped} durationMs=${result.durationMs} ` +
      `errors=${result.errors.length} outputPath=${result.outputPath}`,
  );

  if (result.totalScraped === 0) {
    console.error('probe-ali: 0 items extracted — probe failed.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('probe-ali: fatal', err);
  process.exitCode = 1;
});
