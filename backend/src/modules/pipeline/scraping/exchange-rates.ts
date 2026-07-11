/**
 * Stub — Exchange rates API fetcher.
 *
 * Full axios implementation lands in this PR as a port of the legacy
 * `legacy/pipeline/scripts/scraping/exchangerates.ts`. The port will
 * read `EXCHANGE_API_KEY` from `ConfigService`, call the same public
 * `open.er-api.com` / `exchangerate-api.com` endpoints, and persist
 * the enriched response under `PIPELINE_RAW_DIR/api/`. Stub keeps the
 * signature so the adapter can wire a static import today.
 */
import type {
  ScrapeResult,
  SourceConfig,
} from '@web-scraping/contracts/pipeline';

// eslint-disable-next-line @typescript-eslint/require-await
export async function fetchExchangeRates(
  config: SourceConfig,
): Promise<ScrapeResult> {
  void config;
  throw new Error(
    'exchange-rates: not implemented yet; see PR 2 (browser-factory-stealth, BFS-S5)',
  );
}
