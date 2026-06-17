export interface ScrapingJob {
  jobId: string;
  url: string;
  domainRuleId: string;
  selectors: {
    title: string;
    price: string;
    image?: string;
    sku?: string;
  };
  selectorType: 'css' | 'xpath';
}

export interface ScrapedData {
  success: boolean;
  title?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  sku?: string;
  error?: string;
  rawHtml?: string;
}

export interface DomainRule {
  selectors: {
    title: string;
    price: string;
    image?: string;
    sku?: string;
  };
  selectorType: 'css' | 'xpath';
}

// Payload sent to backend POST /scraping-jobs/:jobId/result
// jobId goes in the URL, not the body (backend uses forbidNonWhitelisted)
export interface ScrapeResultPayload {
  success: boolean;
  title?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  sku?: string;
  description?: string;
  error?: string;
}

// ─── Page Fetch Types ───────────────────────────────────────

/** Message consumed from the `page-fetch` queue. */
export interface FetchPageJob {
  requestId: string;
  url: string;
  cookies?: string; // JSON string of cookie array: [{"name":"...","value":"...",...}]
}

/** An interactive element detected on the rendered page. */
export interface DetectedElement {
  tag: string;
  text: string;
  selector: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** Payload sent by the worker to POST /api/fetch-page/:id/result. */
export interface FetchPageResultPayload {
  success: boolean;
  html?: string;
  title?: string;
  screenshot?: string; // Base64 encoded screenshot
  viewport?: {
    width: number;
    height: number;
  };
  detectedElements?: DetectedElement[];
  captchaDetected?: boolean;
  error?: string;
}

// ─── Listing / Field Mapping Types ──────────────────────────

/** A single field mapping entry that maps a canonical field to a CSS selector. */
export interface FieldMapping {
  canonicalField: string;
  selector: string;
  type: 'text' | 'attribute' | 'html';
  attribute?: string;
}

/** Message consumed from the `scraping_jobs` queue with type='listing'. */
export interface ListingJobMessage {
  jobId: string;
  url: string;
  domainRuleId: string;
  type: 'listing';
  containerSelector: string;
  fieldMappings: FieldMapping[];
  limit?: number;
  selectorType: 'css' | 'xpath';
}

/** Extracted data for a single product from a listing scrape. */
export interface ListingProduct {
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  productUrl?: string | null;
  [key: string]: string | number | undefined | null;
}

/** Payload sent by the worker for a listing scrape result. */
export interface ListingResultPayload {
  success: boolean;
  type: 'listing';
  products?: ListingProduct[];
  truncated?: boolean;
  error?: string;
}
