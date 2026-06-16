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
