/**
 * Regression test for CRITICAL-2: scrapeBooks() must return the results array.
 *
 * Before fix: scrapeBooks() in pipeline/scripts/scraping/aliexpress.ts saved
 * to disk via saveToRaw but did NOT return the array. TypeScript inferred
 * `Promise<void>`, and worker/src/jobs/aliexpress.job.ts errored with
 * TS2322 ("Type 'void' is not assignable to type 'ScrapedProduct[]'").
 *
 * After fix: scrapeBooks() returns the populated results array.
 *
 * This test exercises the REAL pipeline module (NOT mocked at the
 * scrapeBooks level — that mock lives in aliexpress.job.test.ts).
 *
 * Mocking strategy (rationale for each):
 *  - `playwright` → manual mock via moduleNameMapper (see jest.config.js).
 *    Required because pipeline/ has its OWN playwright in pipeline/node_modules
 *    and jest.mock('playwright') alone wouldn't intercept that resolution.
 *  - `pipeline/scripts/scraping/_base` → file-level jest.mock. Scrape uses
 *    randomDelay(2000, 4000) twice per page × 3 pages = 12-24s of wall time.
 *    Mocking randomDelay to resolve instantly keeps the test fast. saveToRaw
 *    and logError are stubbed so we don't touch pipeline/raw/ (tracked by
 *    git). USER_AGENT is a constant.
 *  - `fs` → file-level jest.mock with mkdirSync/writeFileSync/appendFileSync
 *    stubbed, to belt-and-suspenders the hermeticity guarantee in case
 *    _base.ts is reached through a code path that bypasses our mock above.
 */

jest.mock('../../../pipeline/scripts/scraping/_base', () => ({
  USER_AGENT: 'mocked-ua/1.0',
  saveToRaw: jest.fn(),
  logError: jest.fn(),
  randomDelay: jest.fn().mockResolvedValue(undefined),
  delay: jest.fn().mockResolvedValue(undefined),
  createBrowser: jest.fn(),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    appendFileSync: jest.fn(),
  };
});

import { scrapeBooks } from '../../../pipeline/scripts/scraping/aliexpress';

describe('scrapeBooks (pipeline) — CRITICAL-2 regression', () => {
  it('returns the array of scraped products (not undefined)', async () => {
    // RED before fix: scrapeBooks returns void → await resolves to undefined.
    // GREEN after fix: scrapeBooks returns the populated results array.
    const result = await scrapeBooks();

    // The smoking gun for CRITICAL-2: without the fix, result === undefined
    // and every assertion below fails.
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // PAGES has 3 URLs and the mock evaluate returns 2 items per URL → 6.
    expect((result as unknown[]).length).toBeGreaterThan(0);
  });
});