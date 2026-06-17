import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  DomainRule,
  FieldMapping,
  DetectedElement,
} from '../../services/api.service';

// ─── Types ──────────────────────────────────────────────────

type MapperState =
  | 'idle'
  | 'fetching'
  | 'captcha'
  | 'preview'
  | 'mapping'
  | 'scraping'
  | 'done'
  | 'error';

// ─── Canonical fields ───────────────────────────────────────

const CANONICAL_FIELDS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'price', label: 'Price', required: true },
  { key: 'imageUrl', label: 'Image URL', required: false },
  { key: 'sku', label: 'SKU', required: false },
  { key: 'currency', label: 'Currency', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'category', label: 'Category', required: false },
] as const;

type CanonicalFieldKey = (typeof CANONICAL_FIELDS)[number]['key'];

function getFieldType(key: CanonicalFieldKey): FieldMapping['type'] {
  if (key === 'imageUrl') return 'attribute';
  if (key === 'description') return 'html';
  return 'text';
}

function getFieldAttribute(
  key: CanonicalFieldKey,
): string | undefined {
  if (key === 'imageUrl') return 'src';
  return undefined;
}

// ─── Component ──────────────────────────────────────────────

@Component({
  selector: 'app-visual-mapper',
  imports: [FormsModule, RouterLink],
  templateUrl: './visual-mapper.component.html',
  styleUrl: './visual-mapper.component.css',
})
export class VisualMapperComponent implements OnInit, OnDestroy {
  @ViewChild('screenshotContainer') screenshotContainer!: ElementRef<HTMLDivElement>;

  // State machine
  currentState: MapperState = 'idle';

  // URL input
  url = '';
  urlValidationError = '';

  // Fetch page result
  fetchRequestId: string | null = null;
  pageHtml: string | null = null;
  pageTitle: string | null = null;
  screenshotData: string | null = null;
  viewport = { width: 0, height: 0 };
  detectedElements: DetectedElement[] = [];
  captchaCookies = '';
  captchaUrl = '';

  // Domain rules (for existence check)
  domains: DomainRule[] = [];

  // Field mappings
  fieldMappings: FieldMapping[] = [];

  // Container
  containerSelector: string | null = null;
  containerMatchCount = 0;
  productLimit = 20;

  // Interaction
  selectedElement: DetectedElement | null = null;
  hoveredElement: DetectedElement | null = null;
  floatingMenuVisible = false;
  floatingMenuX = 0;
  floatingMenuY = 0;

  // Scraping
  scrapingJobId: string | null = null;
  productsScraped = 0;
  wasTruncated = false;
  savedDomainRuleId: string | null = null;

  // Error
  errorMessage = '';

  // Polling
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private readonly maxPollAttempts = 20;

  constructor(
    private readonly apiService: ApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.loadDomains();
  }

  ngOnDestroy(): void {
    this.clearPolling();
  }

  // ─── Domain loading ───────────────────────────────────────

  private loadDomains(): void {
    this.apiService.getDomains().subscribe({
      next: (domains) => {
        this.domains = domains;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load domains', err);
        this.cdr.markForCheck();
      },
    });
  }

  // ─── URL validation ───────────────────────────────────────

  private isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // ─── Fetch page ───────────────────────────────────────────

  fetchPage(): void {
    this.urlValidationError = '';

    if (!this.url.trim()) {
      this.urlValidationError = 'Please enter a URL.';
      return;
    }

    if (!this.isValidUrl(this.url.trim())) {
      this.urlValidationError =
        'Invalid URL. Must start with http:// or https://';
      return;
    }

    this.currentState = 'fetching';
    this.errorMessage = '';
    this.pageHtml = null;
    this.pageTitle = null;
    this.screenshotData = null;
    this.detectedElements = [];
    this.fieldMappings = [];
    this.containerSelector = null;
    this.containerMatchCount = 0;
    this.selectedElement = null;
    this.floatingMenuVisible = false;
    this.cdr.markForCheck();

    this.apiService.fetchPage(this.url.trim()).subscribe({
      next: (response) => {
        this.fetchRequestId = response.id;
        this.cdr.markForCheck();
        this.startFetchPolling(response.id);
      },
      error: (err) => {
        this.currentState = 'error';
        this.errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to start page fetch.';
        this.cdr.markForCheck();
      },
    });
  }

  private startFetchPolling(requestId: string): void {
    this.pollAttempts = 0;
    this.pollInterval = setInterval(() => {
      this.pollAttempts++;
      this.apiService.getFetchResult(requestId).subscribe({
        next: (response) => {
          if (response.captchaDetected) {
            this.clearPolling();
            this.captchaUrl = this.url;
            this.currentState = 'captcha';
            this.cdr.markForCheck();
          } else if (response.status === 'completed' && response.result) {
            this.clearPolling();
            this.pageHtml = response.result.html;
            this.pageTitle = response.result.title;
            this.screenshotData = response.result.screenshot;
            this.viewport = response.result.viewport;
            this.detectedElements = response.result.detectedElements;
            this.currentState = 'preview';
            this.cdr.markForCheck();
          } else if (response.status === 'failed') {
            this.clearPolling();
            this.currentState = 'error';
            this.errorMessage =
              response.errorMessage || 'Page fetch failed.';
            this.cdr.markForCheck();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Fetch poll error', err);
          this.cdr.markForCheck();
        },
      });

      if (this.pollAttempts >= 40) {
        this.clearPolling();
        this.currentState = 'error';
        this.errorMessage = 'Page fetch timed out. Please try again.';
        this.cdr.markForCheck();
      }
    }, 2000);
  }

  // ─── Interaction ──────────────────────────────────────────

  onElementHover(element: DetectedElement): void {
    this.hoveredElement = element;
  }

  onElementLeave(): void {
    this.hoveredElement = null;
  }

  onElementClick(event: MouseEvent, element: DetectedElement): void {
    event.stopPropagation();
    this.selectedElement = element;
    
    // Position menu near the click
    this.floatingMenuX = element.rect.x + (element.rect.width / 2);
    this.floatingMenuY = element.rect.y + element.rect.height;

    // Boundary check for menu
    if (this.floatingMenuX > this.viewport.width - 200) {
      this.floatingMenuX = this.viewport.width - 250;
    }

    this.floatingMenuVisible = true;
    this.cdr.markForCheck();
  }

  isElementHighlighted(element: DetectedElement): boolean {
    if (this.hoveredElement?.selector === element.selector) return true;
    if (this.selectedElement?.selector === element.selector) return true;
    
    // Check if element is mapped to any field
    return this.fieldMappings.some(m => m.selector === element.selector);
  }

  // ─── Field assignment ─────────────────────────────────────

  assignToField(fieldKey: CanonicalFieldKey): void {
    if (!this.selectedElement) return;

    const type = getFieldType(fieldKey);
    const attribute = getFieldAttribute(fieldKey);

    this.fieldMappings = this.fieldMappings.filter(
      (m) => m.canonicalField !== fieldKey,
    );

    this.fieldMappings.push({
      canonicalField: fieldKey,
      selector: this.selectedElement.selector,
      type,
      ...(attribute ? { attribute } : {}),
    });

    this.floatingMenuVisible = false;
    if (this.currentState === 'preview') {
      this.currentState = 'mapping';
    }
    this.cdr.markForCheck();
  }

  removeAssignment(fieldKey: string): void {
    this.fieldMappings = this.fieldMappings.filter(
      (m) => m.canonicalField !== fieldKey,
    );
    this.cdr.markForCheck();
  }

  // ─── Container selector ───────────────────────────────────

  setAsContainer(): void {
    if (!this.selectedElement) return;

    this.containerSelector = this.selectedElement.selector;
    this.floatingMenuVisible = false;

    // Count matches locally from detectedElements (best-effort)
    this.containerMatchCount = this.detectedElements.filter(
      el => el.selector === this.containerSelector
    ).length;

    if (this.currentState === 'preview') {
      this.currentState = 'mapping';
    }

    this.cdr.markForCheck();
  }

  removeContainer(): void {
    this.containerSelector = null;
    this.containerMatchCount = 0;
    this.cdr.markForCheck();
  }

  // ─── Field helpers ────────────────────────────────────────

  getFieldMapping(key: string): FieldMapping | undefined {
    return this.fieldMappings.find((m) => m.canonicalField === key);
  }

  isFieldMapped(key: string): boolean {
    return !!this.getFieldMapping(key);
  }

  get mappedFieldsCount(): number {
    return this.fieldMappings.length;
  }

  get isSaveEnabled(): boolean {
    return (
      this.isFieldMapped('title') &&
      this.isFieldMapped('price') &&
      !!this.containerSelector
    );
  }

  get canonicalFields(): ReadonlyArray<{
    key: CanonicalFieldKey;
    label: string;
    required: boolean;
  }> {
    return CANONICAL_FIELDS;
  }

  // ─── Save & Scrape ────────────────────────────────────────

  saveAndScrape(): void {
    if (!this.isSaveEnabled || !this.url.trim()) return;

    this.currentState = 'scraping';
    this.errorMessage = '';
    this.savedDomainRuleId = null;
    this.scrapingJobId = null;
    this.floatingMenuVisible = false;
    this.cdr.markForCheck();

    const hostname = this.extractHostname(this.url);
    const titleMapping = this.getFieldMapping('title');
    const priceMapping = this.getFieldMapping('price');

    const domainData: Partial<DomainRule> = {
      domain: hostname,
      name: this.pageTitle || hostname,
      selectorTitle: titleMapping?.selector || '',
      selectorPrice: priceMapping?.selector || '',
      selectorType: 'css',
      sampleUrl: this.url.trim(),
      fieldMappings: this.fieldMappings,
      containerSelector: this.containerSelector || undefined,
      productLimit: this.productLimit,
    };

    const existingDomain = this.domains.find(
      (d) => d.domain === hostname,
    );

    const saveOp = existingDomain
      ? this.apiService.updateDomain(existingDomain.id, {
          fieldMappings: this.fieldMappings,
          containerSelector: this.containerSelector || undefined,
          productLimit: this.productLimit,
        })
      : this.apiService.createDomain(domainData);

    saveOp.subscribe({
      next: (savedDomain) => {
        this.savedDomainRuleId = savedDomain.id;
        this.cdr.markForCheck();
        this.triggerScrapeListing(savedDomain.id);
      },
      error: (err) => {
        this.currentState = 'error';
        this.errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to save domain rule.';
        this.cdr.markForCheck();
      },
    });
  }

  private triggerScrapeListing(domainRuleId: string): void {
    this.apiService
      .scrapeListing(domainRuleId, this.url.trim(), this.productLimit)
      .subscribe({
        next: (response) => {
          this.scrapingJobId = response.id;
          this.cdr.markForCheck();
          this.startScrapePolling(response.id);
        },
        error: (err) => {
          this.currentState = 'error';
          this.errorMessage =
            err.error?.message ||
            err.message ||
            'Failed to start listing scrape.';
          this.cdr.markForCheck();
        },
      });
  }

  private startScrapePolling(jobId: string): void {
    this.pollAttempts = 0;
    this.pollInterval = setInterval(() => {
      this.pollAttempts++;
      this.apiService.getJobStatus(jobId).subscribe({
        next: (job) => {
          if (job.status === 'completed') {
            this.clearPolling();
            const result = job.result || {};
            this.productsScraped = result.count ?? result.products?.length ?? 0;
            this.wasTruncated = !!result.truncated;
            this.currentState = 'done';
            this.cdr.markForCheck();
          } else if (job.status === 'failed') {
            this.clearPolling();
            this.currentState = 'error';
            this.errorMessage =
              job.errorMessage || 'Scraping job failed.';
            this.cdr.markForCheck();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Scrape poll error', err);
          this.cdr.markForCheck();
        },
      });

      if (this.pollAttempts >= this.maxPollAttempts) {
        this.clearPolling();
        this.currentState = 'error';
        this.errorMessage =
          'Scraping is taking longer than expected. Check the products page later.';
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  // ─── Utils ────────────────────────────────────────────────

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // ─── CAPTCHA retry ────────────────────────────────────────

  captchaRetry(): void {
    if (!this.url.trim()) return;
    this.currentState = 'fetching';
    this.errorMessage = '';
    this.pageHtml = null;
    this.pageTitle = null;
    this.screenshotData = null;
    this.fetchRequestId = null;
    this.cdr.markForCheck();

    this.apiService.fetchPage(this.url.trim(), this.captchaCookies?.trim() || undefined).subscribe({
      next: (response) => {
        this.fetchRequestId = response.id;
        this.cdr.markForCheck();
        this.startFetchPolling(response.id);
      },
      error: (err) => {
        this.currentState = 'error';
        this.errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to retry page fetch.';
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Reset ────────────────────────────────────────────────

  tryAgain(): void {
    this.clearPolling();
    this.currentState = 'idle';
    this.errorMessage = '';
    this.pageHtml = null;
    this.pageTitle = null;
    this.screenshotData = null;
    this.detectedElements = [];
    this.fetchRequestId = null;
    this.fieldMappings = [];
    this.containerSelector = null;
    this.containerMatchCount = 0;
    this.selectedElement = null;
    this.hoveredElement = null;
    this.floatingMenuVisible = false;
    this.scrapingJobId = null;
    this.savedDomainRuleId = null;
    this.cdr.markForCheck();
  }

  // ─── Polling cleanup ──────────────────────────────────────

  private clearPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  dismissFloatingMenu(): void {
    this.floatingMenuVisible = false;
  }
}
