/**
 * Aliexpress ETL job — thin wrapper around the cross-package scraper.
 *
 * The real scraping logic lives in `backend/pipeline/scripts/scraping/aliexpress.ts`
 * (kept untouched in spirit — only the auto-execute block was removed and
 * the function was made exportable). The worker imports `scrapeBooks` and
 * exposes it as `runAliexpressScrape` so callers (PR 2 cron wiring) see a
 * stable, well-typed job surface.
 */
import { scrapeBooks } from '../../../backend/pipeline/scripts/scraping/aliexpress';

export type ScrapedProduct = Record<string, unknown>;

export async function runAliexpressScrape(): Promise<ScrapedProduct[]> {
  return scrapeBooks();
}