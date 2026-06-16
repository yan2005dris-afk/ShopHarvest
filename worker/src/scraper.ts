import { PlaywrightCrawler } from 'crawlee';
import type { DomainRule, ScrapedData } from './types.js';

/**
 * Scrapes a given URL using Crawlee's PlaywrightCrawler.
 * Applies the CSS/XPath selectors defined in the domain rule.
 *
 * @param url   - The target product URL.
 * @param rule  - Domain rule with selectors to extract.
 * @returns     - Structured scraped data.
 */
export async function scrapeUrl(url: string, rule: DomainRule): Promise<ScrapedData> {
  let extractedData: ScrapedData = { success: false };

  const crawler = new PlaywrightCrawler({
    // Use headless browser — no UI needed in a worker context
    headless: true,

    requestHandler: async ({ page, request, enqueueLinks, log }) => {
      log.info(`Processing ${request.url}`);

      try {
        // Wait for the body to be loaded
        await page.waitForLoadState('networkidle');

        let title: string | undefined;
        let price: string | undefined;
        let imageUrl: string | undefined;
        let sku: string | undefined;

        if (rule.selectorType === 'xpath') {
          title = await extractByXPath(page, rule.selectors.title);
          price = await extractByXPath(page, rule.selectors.price);
          if (rule.selectors.image) {
            imageUrl = await extractAttributeByXPath(page, rule.selectors.image, 'src');
          }
          if (rule.selectors.sku) {
            sku = await extractByXPath(page, rule.selectors.sku);
          }
        } else {
          // CSS selectors (default)
          title = await extractByCss(page, rule.selectors.title);
          price = await extractByCss(page, rule.selectors.price);
          if (rule.selectors.image) {
            imageUrl = await extractAttributeByCss(page, rule.selectors.image, 'src');
          }
          if (rule.selectors.sku) {
            sku = await extractByCss(page, rule.selectors.sku);
          }
        }

        const parsedPrice = parsePrice(price);

        extractedData = {
          success: true,
          title,
          price: parsedPrice,
          currency: detectCurrency(price),
          imageUrl,
          sku,
        };

        log.info(`Extracted data from ${request.url}: ${JSON.stringify(extractedData)}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Failed to scrape ${request.url}: ${message}`);
        extractedData = {
          success: false,
          error: message,
        };
      }
    },

    // Handle navigation errors gracefully
    failedRequestHandler: async ({ request, log }) => {
      log.error(`Request ${request.url} failed after all retries`);
      extractedData = {
        success: false,
        error: `Navigation failed for ${request.url}`,
      };
    },
  });

  await crawler.run([url]);

  return extractedData;
}

// ─── Helpers ────────────────────────────────────────────────

async function extractByCss(page: any, selector: string): Promise<string | undefined> {
  try {
    const el = await page.locator(selector).first();
    if (el) {
      const text = await el.textContent();
      return text?.trim() || undefined;
    }
  } catch {
    // selector not found — return undefined
  }
  return undefined;
}

async function extractAttributeByCss(page: any, selector: string, attr: string): Promise<string | undefined> {
  try {
    const el = await page.locator(selector).first();
    if (el) {
      const value = await el.getAttribute(attr);
      return value?.trim() || undefined;
    }
  } catch {
    // selector not found — return undefined
  }
  return undefined;
}

async function extractByXPath(page: any, selector: string): Promise<string | undefined> {
  try {
    const el = page.locator(selector).first();
    if (el) {
      const text = await el.textContent();
      return text?.trim() || undefined;
    }
  } catch {
    // selector not found — return undefined
  }
  return undefined;
}

async function extractAttributeByXPath(page: any, selector: string, attr: string): Promise<string | undefined> {
  try {
    const el = page.locator(selector).first();
    if (el) {
      const value = await el.getAttribute(attr);
      return value?.trim() || undefined;
    }
  } catch {
    // selector not found — return undefined
  }
  return undefined;
}

/**
 * Attempts to parse a price string into a number.
 * Handles formats like "$1,234.56", "1.234,56 €", "ARS 500.00", etc.
 */
function parsePrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined;

  // Remove currency symbols and known suffixes
  let cleaned = raw.replace(/[^0-9.,\s-]/g, '').trim();

  // Detect European format: 1.234,56 (dot as thousand, comma as decimal)
  if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard format: remove commas as thousand separators
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Basic currency detection from price text.
 */
function detectCurrency(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  const upper = raw.toUpperCase();
  if (upper.includes('USD') || raw.includes('$')) return 'USD';
  if (upper.includes('EUR') || raw.includes('€')) return 'EUR';
  if (upper.includes('ARS') || raw.includes('AR$')) return 'ARS';
  if (upper.includes('BRL') || raw.includes('R$')) return 'BRL';
  if (upper.includes('GBP') || raw.includes('£')) return 'GBP';
  if (upper.includes('CLP') || raw.includes('CL$')) return 'CLP';
  if (upper.includes('MXN') || raw.includes('MX$')) return 'MXN';
  if (upper.includes('COP') || raw.includes('CO$')) return 'COP';
  if (upper.includes('PEN') || raw.includes('S/')) return 'PEN';

  return undefined;
}
