import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';
import { Camoufox } from 'camoufox-js';
import type { Browser, BrowserContext, Page } from 'playwright';
import type {
  DomainRule,
  ScrapedData,
  DetectedElement,
  FieldMapping,
  ListingProduct,
} from './types.js';

/**
 * Creates a Crawlee ProxyConfiguration based on environment variables.
 */
function getProxyConfiguration(): ProxyConfiguration | undefined {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) return undefined;

  return new ProxyConfiguration({
    proxyUrls: [proxyUrl],
  });
}

/**
 * Scrapes a given URL using Crawlee's PlaywrightCrawler.
 * Applies the CSS/XPath selectors defined in the domain rule.
 * 
 * NOTE: Using standard PlaywrightCrawler here but with Proxy + Fingerprints.
 * For tougher targets, the dedicated Camoufox functions below are used.
 */
export async function scrapeUrl(url: string, rule: DomainRule): Promise<ScrapedData> {
  let extractedData: ScrapedData = { success: false };

  const crawler = new PlaywrightCrawler({
    headless: true,

    // Proxy + Fingerprints for the crawler
    proxyConfiguration: getProxyConfiguration(),
    browserPoolOptions: {
      useFingerprints: true,
    },

    requestHandler: async ({ page, request, log }) => {
      log.info(`Processing ${request.url}`);

      try {
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

// ─── Page Fetch with Camoufox ───────────────────────────────

const PAGE_TIMEOUT_MS = 60000; // Increased for Firefox/Cloudflare

/** Discriminated result type for fetchPage — success, captcha, or error. */
export type FetchPageResult =
  | {
      success: true;
      html: string;
      title: string;
      screenshot: string;
      viewport: { width: number; height: number };
      detectedElements: DetectedElement[];
    }
  | { success: false; captchaDetected: true; captchaUrl?: string }
  | { success: false; captchaDetected: false; error: string };

// ─── Persistent browser (Camoufox instance) ──────

let persistentBrowser: Browser | null = null;
let persistentContext: BrowserContext | null = null;

/**
 * Returns the persistent Camoufox browser instance.
 */
async function getOrCreateBrowser(): Promise<Browser> {
  if (!persistentBrowser) {
    persistentBrowser = await Camoufox({
      headless: true,
      os: 'windows',
      humanize: true,
      geoip: true, // Use GeoIP to match proxy location
      proxy: process.env.PROXY_URL ? {
        server: process.env.PROXY_URL
      } : undefined
    }) as unknown as Browser;
  }
  return persistentBrowser;
}

/**
 * Returns the persistent browser context.
 */
async function getOrCreateContext(): Promise<BrowserContext> {
  if (!persistentContext) {
    const browser = await getOrCreateBrowser();
    // Context is created by Camoufox during launch usually, but we want to manage it
    persistentContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
  }
  return persistentContext;
}

/**
 * Closes the persistent browser and context.
 */
export async function closeOpenBrowser(): Promise<void> {
  if (persistentContext) {
    try { await persistentContext.close(); } catch {}
    persistentContext = null;
  }
  if (persistentBrowser) {
    try { await persistentBrowser.close(); } catch {}
    persistentBrowser = null;
  }
}

const CAPTCHA_KEYWORDS = [
  'captcha',
  'security verification',
  'verify you are human',
  'verify your identity',
  'cloudflare',
  'challenge',
  'denied',
  'access denied',
  'automated access',
  'please wait',
  'checking your browser',
  'ddos protection',
  'attention required',
  'blocked',
  'sorry, you have been blocked',
];

/**
 * Checks if the current page is showing a CAPTCHA.
 */
async function detectCaptcha(page: Page, pageTitle: string): Promise<boolean> {
  const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const currentUrl = page.url();

  const titleLower = pageTitle.toLowerCase();
  const bodyLower = bodyText.toLowerCase();
  const urlLower = currentUrl.toLowerCase();

  const textMatch = CAPTCHA_KEYWORDS.some(
    (kw) => titleLower.includes(kw) || bodyLower.includes(kw) || urlLower.includes(kw),
  );

  const elementMatch = await page
    .evaluate(() => {
      const selectors = [
        '#challenge-running',
        '#cf-challenge',
        '#challenge-form',
        '[id*="captcha"]',
        '[class*="captcha"]',
        'iframe[src*="captcha"]',
        'iframe[src*="challenge"]',
      ];
      return selectors.some((sel) => !!document.querySelector(sel));
    })
    .catch(() => false);

  return textMatch || elementMatch;
}

/**
 * Opens a URL with Camoufox, extracts visual data and elements.
 */
export async function fetchPage(url: string, cookies?: string): Promise<FetchPageResult> {
  const context = await getOrCreateContext();
  const page = await context.newPage();

  try {
    if (cookies) {
      try {
        const parsed = JSON.parse(cookies);
        await context.addCookies(parsed);
      } catch (e) {
        console.error('[Worker] Invalid cookies JSON:', e);
      }
    }

    // Camoufox handles bypass during navigation
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    
    // Wait extra for potential Cloudflare turnstile
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const pageTitle = await page.title();

    // ── CAPTCHA detection ──────────────────────────────────
    const isCaptcha = await detectCaptcha(page, pageTitle);
    if (isCaptcha) {
      console.log(`[scraper] CAPTCHA detected for ${url}`);
      await page.close();
      return { success: false, captchaDetected: true, captchaUrl: url };
    }

    // ── Extract HTML, title, and detected elements ─────────
    const { html, title, detectedElements, viewport } = await page.evaluate(() => {
      const rawHtml = document.documentElement.outerHTML;
      const pageTitle = document.title;
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

      const interactiveSelector = [
        'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'img',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'p',
        'div[class*="price"]', 'div[class*="title"]',
        '[role="button"]', '[tabindex]:not([tabindex="-1"])',
      ].join(',');

      const seen = new Set<string>();
      const elements: DetectedElement[] = [];

      document.querySelectorAll(interactiveSelector).forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;

        let text = '';
        if (el instanceof HTMLImageElement) {
          text = el.alt || el.src.split('/').pop() || 'Image';
        } else if (el instanceof HTMLInputElement) {
          text = el.placeholder || el.name || el.title || el.value || '';
        } else if (el instanceof HTMLSelectElement) {
          text = el.name || '';
        } else {
          text = (el as HTMLElement).innerText?.trim() || el.getAttribute('title') || '';
        }

        if (!text && tag !== 'input' && tag !== 'select' && tag !== 'img') return;
        if (text.length > 250) text = text.substring(0, 250) + '…';

        let selector = '';
        if (el.id) {
          selector = `#${CSS.escape(el.id)}`;
        } else {
          const path: string[] = [];
          let current: Element | null = el;
          while (current && current !== document.body && current !== document.documentElement) {
            const t = current.tagName.toLowerCase();
            const parent = current.parentElement as Element | null;
            if (parent) {
              const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === current!.tagName);
              const index = siblings.indexOf(current) + 1;
              path.unshift(siblings.length > 1 ? `${t}:nth-child(${index})` : t);
            } else {
              path.unshift(t);
            }
            current = parent;
          }
          selector = path.join(' > ');
        }

        if (seen.has(selector)) return;
        seen.add(selector);

        elements.push({
          tag, text, selector,
          rect: {
            x: b.left + window.scrollX,
            y: b.top + window.scrollY,
            width: b.width,
            height: b.height,
          },
        } as DetectedElement);
      });

      return {
        html: rawHtml,
        title: pageTitle,
        detectedElements: elements,
        viewport: { width: vw, height: vh },
      };
    });

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    const sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<script\b[^>]*\/>/gi, '')
      .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, 'nojavascript:');

    await page.close();
    return {
      success: true,
      html: sanitized,
      title,
      screenshot: screenshotBase64,
      viewport,
      detectedElements,
    };
  } catch (err) {
    await page.close();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scraper] fetchPage error: ${message}`);
    return { success: false, captchaDetected: false, error: message };
  }
}

// ─── Listing Scrape with Camoufox ───────────────────────────

export async function scrapeListing(
  url: string,
  containerSelector: string,
  fieldMappings: FieldMapping[],
  limit?: number,
): Promise<{ products: ListingProduct[]; truncated: boolean }> {
  const browser = await Camoufox({
    headless: true,
    os: 'windows',
    humanize: true,
    proxy: process.env.PROXY_URL ? { server: process.env.PROXY_URL } : undefined
  }) as unknown as Browser;

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(5000);

    const containers = page.locator(containerSelector);
    const totalCount = await containers.count();

    if (totalCount === 0) return { products: [], truncated: false };

    const effectiveLimit = limit ?? 20;
    const cappedLimit = Math.min(effectiveLimit, 100);
    const processCount = Math.min(totalCount, cappedLimit);
    const truncated = processCount < totalCount;

    const products: ListingProduct[] = [];

    for (let i = 0; i < processCount; i++) {
      const container = containers.nth(i);
      const product: ListingProduct = {};

      for (const mapping of fieldMappings) {
        try {
          const subEl = container.locator(mapping.selector).first();
          if (await subEl.count() > 0) {
            let rawValue: string | null = null;
            switch (mapping.type) {
              case 'text': rawValue = (await subEl.textContent())?.trim() ?? null; break;
              case 'attribute': rawValue = (await subEl.getAttribute(mapping.attribute ?? '')) ?? null; break;
              case 'html': rawValue = (await subEl.innerHTML())?.trim() ?? null; break;
            }

            if (rawValue !== null) {
              if (mapping.canonicalField === 'price') product.price = parsePrice(rawValue) ?? null;
              else if (mapping.canonicalField === 'currency') product.currency = detectCurrency(rawValue) ?? null;
              else product[mapping.canonicalField] = rawValue;
            }
          }
        } catch { /* ignore field error */ }
      }

      if (product.title != null && product.price != null) {
        products.push(product);
      }
    }

    return { products, truncated };
  } finally {
    await browser.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────

async function extractByCss(page: any, selector: string): Promise<string | undefined> {
  try {
    const el = await page.locator(selector).first();
    return (await el?.textContent())?.trim() || undefined;
  } catch { return undefined; }
}

async function extractAttributeByCss(page: any, selector: string, attr: string): Promise<string | undefined> {
  try {
    const el = await page.locator(selector).first();
    return (await el?.getAttribute(attr))?.trim() || undefined;
  } catch { return undefined; }
}

async function extractByXPath(page: any, selector: string): Promise<string | undefined> {
  try {
    const el = page.locator(selector).first();
    return (await el?.textContent())?.trim() || undefined;
  } catch { return undefined; }
}

async function extractAttributeByXPath(page: any, selector: string, attr: string): Promise<string | undefined> {
  try {
    const el = page.locator(selector).first();
    return (await el?.getAttribute(attr))?.trim() || undefined;
  } catch { return undefined; }
}

function parsePrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  let cleaned = raw.replace(/[^0-9.,\s-]/g, '').trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

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
