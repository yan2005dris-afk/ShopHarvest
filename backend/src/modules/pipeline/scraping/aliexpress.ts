/**
 * Stub — AliExpress real scraper.
 *
 * Full Playwright + stealth + lazy-load scroll + retry implementation
 * lands in PR 4 (aliexpress-real-scraper). This stub preserves the
 * signature so the adapter can wire a static import today.
 */
import type {
  ScrapeResult,
  SourceConfig,
} from '@web-scraping/contracts/pipeline';

// eslint-disable-next-line @typescript-eslint/require-await
export async function scrapeAliExpress(
  config: SourceConfig,
): Promise<ScrapeResult> {
  void config;
  throw new Error(
    'aliexpress: not implemented yet; see PR 4 (aliexpress-real-scraper)',
  );
}
