/**
 * Options for `BrowserFactoryService.launch()` and `newContext()`.
 *
 * Used by Playwright-based scrapers (MELI, AliExpress) in PR 3 and PR 4.
 * Extension-based scrapers (Temu, Shein) do not consume this — they
 * read the user's Chrome extension export instead.
 *
 * Defaults (set in BrowserFactoryService, not here):
 * - acceptLanguage: 'es-EC,es;q=0.9'
 * - userAgent: a current Chrome on Windows string
 * - viewport: 1366 × 768
 */
export interface BrowserFactoryOptions {
  /**
   * true → sticky IP per session (login flows like a future Shein Playwright).
   * false (default) → rotating IP per launch. Only meaningful when
   * SCRAPER_PROXY_SERVER is set.
   */
  stickySession?: boolean;

  /** Accept-Language header override. Forwarded to the BrowserContext. */
  acceptLanguage?: string;

  /** User-Agent override. Forwarded to the BrowserContext. */
  userAgent?: string;

  /** Viewport size. Forwarded to the BrowserContext. */
  viewport?: { width: number; height: number };
}
