/**
 * Stub — MercadoLibre Ecuador real scraper.
 *
 * Full Playwright + stealth + retry implementation lands in PR 3
 * (mercadolibre-real-scraper). This stub preserves the signature so the
 * adapter can wire a static import today.
 */
import type {
  ScrapeResult,
  SourceConfig,
} from '@web-scraping/contracts/pipeline';

// eslint-disable-next-line @typescript-eslint/require-await
export async function scrapeMercadoLibre(
  config: SourceConfig,
): Promise<ScrapeResult> {
  void config;
  throw new Error(
    'mercadolibre: not implemented yet; see PR 3 (mercadolibre-real-scraper)',
  );
}
