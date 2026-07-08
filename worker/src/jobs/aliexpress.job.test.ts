/**
 * Tests for the aliexpress ETL job wrapper.
 *
 * RED phase: the wrapper does not exist yet. We mock the underlying
 * `scrapeBooks` function so the test exercises the cross-package import
 * resolution and the shape returned by the wrapper, without touching
 * Playwright or the real books.toscrape.com site.
 */
import { runAliexpressScrape } from './aliexpress.job';

// Mock the underlying scrape function so we don't hit the network or
// require Playwright at test time. The mock is hoisted by jest.mock.
jest.mock('../../../backend/pipeline/scripts/scraping/aliexpress', () => ({
  scrapeBooks: jest.fn(),
}));

import { scrapeBooks } from '../../../backend/pipeline/scripts/scraping/aliexpress';

const mockedScrape = scrapeBooks as jest.MockedFunction<typeof scrapeBooks>;

describe('runAliexpressScrape (worker wrapper)', () => {
  it('returns the raw rows produced by scrapeBooks', async () => {
    const fakeRows = [
      { titulo: 'Sharp Objects', precio: '£47.82', moneda: 'GBP', categoria: 'mystery' },
      { titulo: 'The Stand', precio: '£36.20', moneda: 'GBP', categoria: 'fiction' },
    ];
    mockedScrape.mockResolvedValueOnce(fakeRows as never);

    const result = await runAliexpressScrape();

    expect(result).toEqual(fakeRows);
    expect(mockedScrape).toHaveBeenCalledTimes(1);
  });

  it('propagates errors thrown by the underlying scraper', async () => {
    mockedScrape.mockRejectedValueOnce(new Error('Playwright launch failed'));

    await expect(runAliexpressScrape()).rejects.toThrow(/Playwright launch failed/);
  });
});