import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, DomainRule, FieldMapping } from '../../services/api.service';
import { ExtensionService, MappingCompletePayload } from '../../services/extension.service';

// ─── Types ──────────────────────────────────────────────────

type MapperState =
  | 'idle'
  | 'extension-mapping'
  | 'mapping'
  | 'saving'
  | 'done'
  | 'error';

// ─── Component ──────────────────────────────────────────────

@Component({
  selector: 'app-visual-mapper',
  imports: [FormsModule, RouterLink],
  templateUrl: './visual-mapper.component.html',
  styleUrl: './visual-mapper.component.css',
})
export class VisualMapperComponent implements OnInit, OnDestroy {
  extensionAvailable = false;
  private extensionSub: Subscription | null = null;
  private extensionAvailableSub: Subscription | null = null;

  // State machine
  currentState: MapperState = 'idle';

  // URL input
  url = '';
  urlValidationError = '';

  // Domain rules (for existence check)
  domains: DomainRule[] = [];

  // Field mappings (from extension)
  fieldMappings: FieldMapping[] = [];

  // Container
  containerSelector: string | null = null;

  // Products extracted by extension
  extractedProducts: Record<string, string | number | null>[] = [];

  // Page info
  pageTitle: string | null = null;

  // Error
  errorMessage = '';

  // ── Independent save states ───────────────────────
  /** True after Save Domain Rule succeeds */
  domainRuleSaved = false;
  /** True after Save Products succeeds */
  productsIngested = false;
  /** Loading state for products ingest */
  savingProducts = false;
  /** Error from products ingest (rule can succeed, products can fail) */
  ingestError = '';

  // ── Auto-replay schedule (batch 5) ────────────────────────
  /** Hostname of the rule just saved — target for scheduling. */
  savedDomain: string | null = null;
  scheduleIntervalHours = 24;
  scheduleEnabled = false;
  scheduleSaved = false;
  scheduleError = '';
  savingSchedule = false;

  constructor(
    private readonly apiService: ApiService,
    private readonly extensionService: ExtensionService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.loadDomains();
    this.extensionAvailableSub = this.extensionService.available$.subscribe((available) => {
      this.extensionAvailable = available;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.extensionSub?.unsubscribe();
    this.extensionAvailableSub?.unsubscribe();
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

  // ─── Extension mapping ────────────────────────────────────

  openExtensionMapper(): void {
    this.urlValidationError = '';

    if (!this.url.trim()) {
      this.urlValidationError = 'Please enter a URL.';
      return;
    }

    if (!this.isValidUrl(this.url.trim())) {
      this.urlValidationError = 'Invalid URL. Must start with http:// or https://';
      return;
    }

    this.currentState = 'extension-mapping';
    this.errorMessage = '';
    this.fieldMappings = [];
    this.containerSelector = null;
    this.cdr.markForCheck();

    this.extensionSub?.unsubscribe();
    this.extensionSub = this.extensionService.openMapper(this.url.trim()).subscribe({
      next: (event) => {
        if (event.type === 'MAPPING_COMPLETE') {
          this.applyExtensionResult(event.payload);
        } else if (event.type === 'MAPPING_CANCELLED') {
          this.currentState = 'idle';
          this.cdr.markForCheck();
        } else if (event.type === 'MAPPING_ERROR') {
          this.currentState = 'error';
          this.errorMessage = event.payload.message;
          this.cdr.markForCheck();
        }
      },
      error: (err: Error) => {
        this.currentState = 'error';
        this.errorMessage = err.message;
        this.cdr.markForCheck();
      },
    });
  }

  private applyExtensionResult(payload: MappingCompletePayload): void {
    this.fieldMappings = payload.fieldMappings.map((m) => ({
      canonicalField: m.canonicalField,
      selector: m.selector,
      type: m.type,
      ...(m.attribute ? { attribute: m.attribute } : {}),
    }));
    this.containerSelector = payload.containerSelector;
    this.pageTitle = payload.pageTitle;
    this.extractedProducts = payload.products ?? [];
    this.currentState = 'mapping';
    this.cdr.markForCheck();
  }

  cancelExtensionMapping(): void {
    this.extensionSub?.unsubscribe();
    this.extensionSub = null;
    this.currentState = 'idle';
    this.cdr.markForCheck();
  }

  // ─── Field helpers ────────────────────────────────────────

  getFieldMapping(key: string): FieldMapping | undefined {
    return this.fieldMappings.find((m) => m.canonicalField === key);
  }

  isFieldMapped(key: string): boolean {
    return !!this.getFieldMapping(key);
  }

  removeAssignment(fieldKey: string): void {
    this.fieldMappings = this.fieldMappings.filter(
      (m) => m.canonicalField !== fieldKey,
    );
    this.cdr.markForCheck();
  }

  get mappedFieldsCount(): number {
    return this.fieldMappings.length;
  }

  get totalFieldCount(): number {
    return this.fieldMappings.length;
  }

  get isSaveEnabled(): boolean {
    return this.fieldMappings.length > 0 && !!this.containerSelector;
  }

  // ─── Save Domain Rule ─────────────────────────────────────

  /** Saves ONLY the domain rule (no products) */
  saveRule(): void {
    if (!this.isSaveEnabled || !this.url.trim()) return;

    this.currentState = 'saving';
    this.errorMessage = '';
    this.cdr.markForCheck();

    const hostname = this.extractHostname(this.url);

    const domainData: Partial<DomainRule> = {
      domain: hostname,
      name: this.pageTitle || hostname,
      fieldMappings: this.fieldMappings,
      containerSelector: this.containerSelector || undefined,
    };

    const existingDomain = this.domains.find((d) => d.domain === hostname);

    const saveOp = existingDomain
      ? this.apiService.updateDomain(existingDomain.id, {
          fieldMappings: this.fieldMappings,
          containerSelector: this.containerSelector || undefined,
        })
      : this.apiService.createDomain(domainData);

    saveOp.subscribe({
      next: () => {
        this.domainRuleSaved = true;
        this.savedDomain = hostname;
        this.currentState = 'done';
        this.cdr.markForCheck();
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

  /** Saves ONLY the extracted products (separate from domain rule) */
  saveProducts(): void {
    if (this.extractedProducts.length === 0 || !this.url.trim()) return;

    this.savingProducts = true;
    this.ingestError = '';
    this.cdr.markForCheck();

    const hostname = this.extractHostname(this.url);

    this.apiService.ingestProducts(hostname, this.url, this.extractedProducts as Record<string, unknown>[])
      .subscribe({
        next: () => {
          this.productsIngested = true;
          this.savingProducts = false;
          this.currentState = 'done';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.ingestError = `Failed to ingest products: ${err.message ?? err}`;
          this.savingProducts = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ─── Auto-replay schedule ─────────────────────────────────

  /**
   * Registers (or updates) a per-domain auto-scrape schedule in the extension.
   * The extension fires a chrome.alarm on the chosen interval and re-runs the
   * saved rule whenever a tab on this domain is open. Requires the extension.
   */
  saveSchedule(): void {
    if (!this.savedDomain || !this.extensionAvailable) return;

    this.savingSchedule = true;
    this.scheduleError = '';
    this.scheduleSaved = false;
    this.cdr.markForCheck();

    const intervalMinutes = Math.max(1, Math.round(this.scheduleIntervalHours * 60));

    this.extensionService
      .setSchedule(this.savedDomain, intervalMinutes, this.scheduleEnabled)
      .then((res) => {
        if (res.ok) {
          this.scheduleSaved = true;
        } else {
          this.scheduleError = res.error ?? 'Failed to save schedule.';
        }
      })
      .catch((err: Error) => {
        this.scheduleError = err.message;
      })
      .finally(() => {
        this.savingSchedule = false;
        this.cdr.markForCheck();
      });
  }

  // ─── Utils ────────────────────────────────────────────────

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // ─── Template helpers ─────────────────────────────────────

  isUrlValue(value: unknown): boolean {
    return String(value ?? '').startsWith('http');
  }

  // ─── Reset ────────────────────────────────────────────────

  tryAgain(): void {
    this.currentState = 'idle';
    this.errorMessage = '';
    this.fieldMappings = [];
    this.containerSelector = null;
    this.extractedProducts = [];
    this.domainRuleSaved = false;
    this.productsIngested = false;
    this.savingProducts = false;
    this.ingestError = '';
    this.savedDomain = null;
    this.scheduleEnabled = false;
    this.scheduleSaved = false;
    this.scheduleError = '';
    this.savingSchedule = false;
    this.cdr.markForCheck();
  }
}
