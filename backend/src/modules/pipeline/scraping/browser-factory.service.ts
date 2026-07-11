import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext } from 'playwright';
import type { BrowserFactoryOptions } from '@web-scraping/contracts/pipeline';

/**
 * Default fingerprint. Mimics a current Chrome on Windows desktop.
 * Kept here (not in contracts) because it's an operational default,
 * not part of the wire contract.
 */
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_ACCEPT_LANGUAGE = 'es-EC,es;q=0.9';
const DEFAULT_LOCALE = 'es-EC';
const DEFAULT_VIEWPORT = { width: 1366, height: 768 } as const;

/**
 * BrowserFactoryService — singleton NestJS-injectable that launches
 * Playwright browsers with stealth always on and a residential proxy
 * attached only when SCRAPER_PROXY_SERVER is set.
 *
 * Consumed by Playwright-based scrapers (PR 3 MELI, PR 4 AliExpress).
 * Extension-based scrapers (PR 5 Temu/Shein) do NOT inject this —
 * they read the Chrome extension export instead. The CI guardrail
 * (rule 3) verifies this boundary is not crossed.
 *
 * Stealth plugin registration is process-local: a static flag ensures
 * `chromium.use(stealth())` runs exactly once per process, even if
 * BrowserFactoryService is requested from multiple DI scopes.
 */
@Injectable()
export class BrowserFactoryService {
  private readonly logger = new Logger(BrowserFactoryService.name);
  private static stealthRegistered = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Launch a stealth browser. Attaches the residential proxy ONLY if
   * SCRAPER_PROXY_SERVER is set. Always applies the stealth plugin
   * (no opt-out, by hard rule 2026-07-08).
   *
   * Throws if SCRAPER_PROXY_SERVER is set but SCRAPER_PROXY_PASSWORD
   * is missing — surfacing a misconfigured env early.
   */
  async launch(opts: BrowserFactoryOptions = {}): Promise<Browser> {
    this.registerStealthOnce();

    const headless = this.config.get('SCRAPER_HEADLESS') !== 'false';
    const server = this.config.get<string>('SCRAPER_PROXY_SERVER');
    const useProxy = Boolean(server && server.length > 0);

    if (useProxy) {
      const password = this.config.get<string>('SCRAPER_PROXY_PASSWORD');
      if (!password) {
        throw new Error(
          'SCRAPER_PROXY_SERVER is set but SCRAPER_PROXY_PASSWORD is missing — refusing to launch with broken auth',
        );
      }
    }

    const launchOptions: any = { headless };
    if (useProxy) {
      launchOptions.proxy = {
        server,
        username: this.buildUsername(opts.stickySession),
        password: this.config.get<string>('SCRAPER_PROXY_PASSWORD'),
      };
      this.logger.log(
        `Launching browser with residential proxy (stickySession=${Boolean(opts.stickySession)})`,
      );
    } else {
      this.logger.log(
        'Launching browser WITHOUT proxy (SCRAPER_PROXY_SERVER not set)',
      );
    }

    return chromium.launch(launchOptions);
  }

  /**
   * New context with a realistic fingerprint: User-Agent, locale,
   * viewport, Accept-Language. Callers can override any of these via
   * BrowserFactoryOptions.
   */
  async newContext(
    browser: Browser,
    opts: BrowserFactoryOptions = {},
  ): Promise<BrowserContext> {
    const acceptLanguage = opts.acceptLanguage ?? DEFAULT_ACCEPT_LANGUAGE;
    return browser.newContext({
      userAgent: opts.userAgent ?? DEFAULT_USER_AGENT,
      locale: opts.acceptLanguage?.split(',')[0] ?? DEFAULT_LOCALE,
      viewport: opts.viewport ?? { ...DEFAULT_VIEWPORT },
      extraHTTPHeaders: { 'Accept-Language': acceptLanguage },
    });
  }

  /**
   * Register the stealth plugin exactly once per process. Subsequent
   * calls are a no-op (BFS-S3).
   */
  private registerStealthOnce(): void {
    if (BrowserFactoryService.stealthRegistered) return;
    chromium.use(stealth());
    BrowserFactoryService.stealthRegistered = true;
  }

  /**
   * Inject a session id into the username template so the provider
   * keeps (sticky) or drops (rotating) the IP. The `{session}`
   * placeholder in SCRAPER_PROXY_USERNAME is replaced per launch.
   * If no template is configured but a proxy server is, the empty
   * username is sent as-is (most providers reject this; we surface
   * the misconfiguration as a runtime error in the proxy provider's
   * own error message, not a custom check).
   */
  private buildUsername(sticky = false): string {
    const template = this.config.get<string>('SCRAPER_PROXY_USERNAME') ?? '';
    const session = sticky ? `-session-${Date.now().toString(36)}` : '';
    return template.replace('{session}', session);
  }
}
