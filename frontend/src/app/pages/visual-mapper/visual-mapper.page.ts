import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService, DomainRule, Category } from '../../services/api.service';
import { ExtensionService } from '../../services/extension.service';
import { MappingSessionService } from './services/mapping-session.service';
import { DomainRulePersistenceService, SaveDomainRuleParams, SaveProductsParams } from './services/domain-rule.persistence';
import { MapperHeroComponent } from './components/mapper-hero.component';
import { ExtensionMappingStateComponent } from './components/extension-mapping-state.component';
import { MappingStateComponent } from './components/mapping-state.component';
import { SavingStateComponent } from './components/saving-state.component';
import { DoneStateComponent } from './components/done-state.component';
import { ErrorStateComponent } from './components/error-state.component';

type MapperState =
  | 'idle'
  | 'extension-mapping'
  | 'mapping'
  | 'saving'
  | 'done'
  | 'error';

@Component({
  selector: 'app-visual-mapper',
  standalone: true,
  imports: [
    FormsModule,
    MapperHeroComponent,
    ExtensionMappingStateComponent,
    MappingStateComponent,
    SavingStateComponent,
    DoneStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <div class="flex min-h-dvh flex-col font-sans">
      @switch (currentState()) {
        @case ('idle') {
          <app-mapper-hero
            [session]="session"
            [domains]="domains()"
            [categories]="categories()"
            [extensionAvailable]="extensionAvailable()"
            [(url)]="url"
            [urlValidationError]="urlValidationError()"
            [(categoryId)]="selectedCategoryId"
            (onOpenMapper)="openExtensionMapper()"
          />
        }
        @case ('extension-mapping') {
          <app-extension-mapping-state
            (onCancel)="cancelExtensionMapping()"
          />
        }
        @case ('mapping') {
          <app-mapping-state
            [session]="session"
            [domainRuleSaved]="domainRuleSaved"
            [productsIngested]="productsIngested"
            [savingProducts]="savingProducts"
            [ingestError]="ingestError"
            (onSaveRule)="saveRule()"
            (onSaveProducts)="saveProducts()"
            (onTryAgain)="tryAgain()"
          />
        }
        @case ('saving') {
          <app-saving-state />
        }
        @case ('done') {
          <app-done-state
            [domainRuleSaved]="domainRuleSaved"
            [productsIngested]="productsIngested"
            [extractedProductsCount]="extractedProductsCount()"
            [url]="url"
            [savedDomain]="savedDomain"
            [extensionAvailable]="extensionAvailable()"
            [(scheduleIntervalHours)]="scheduleIntervalHours"
            [(scheduleEnabled)]="scheduleEnabled"
            [scheduleSaved]="scheduleSaved()"
            [scheduleError]="scheduleError()"
            [savingSchedule]="savingSchedule()"
            [ingestError]="ingestError"
            [errorMessage]="errorMessage"
            (onTryAgain)="tryAgain()"
            (onSaveSchedule)="saveSchedule()"
          />
        }
        @case ('error') {
          <app-error-state
            [errorMessage]="errorMessage"
            (onTryAgain)="tryAgain()"
          />
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualMapperPage implements OnInit, OnDestroy {
  private readonly apiService = inject(ApiService);
  private readonly extensionService = inject(ExtensionService);
  readonly session = inject(MappingSessionService);
  private readonly persistence = inject(DomainRulePersistenceService);

  // Extension
  readonly extensionAvailable = toSignal(this.extensionService.available$, { initialValue: false });
  private extensionSub: Subscription | null = null;

  // State machine
  currentState = signal<MapperState>('idle');

  // URL input
  url = '';
  urlValidationError = signal('');

  // Category selection
  selectedCategoryId = signal('');
  categories = signal<Category[]>([]);

  // Domain rules (for existence check)
  domains = signal<DomainRule[]>([]);

  // Save states
  domainRuleSaved = false;
  productsIngested = false;
  savingProducts = false;
  ingestError = '';
  savedDomain: string | null = null;

  // Schedule (batch 5)
  scheduleIntervalHours = signal(24);
  scheduleEnabled = signal(false);
  scheduleSaved = signal(false);
  scheduleError = signal('');
  savingSchedule = signal(false);
  errorMessage = '';

  ngOnInit(): void {
    this.loadDomains();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.extensionSub?.unsubscribe();
  }

  private loadDomains(): void {
    this.apiService.getDomains().subscribe({
      next: (domains) => this.domains.set(domains),
      error: (err) => console.error('Failed to load domains', err),
    });
  }

  private loadCategories(): void {
    this.apiService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  private isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  openExtensionMapper(): void {
    this.urlValidationError.set('');

    if (!this.url.trim()) {
      this.urlValidationError.set('Please enter a URL.');
      return;
    }

    if (!this.isValidUrl(this.url.trim())) {
      this.urlValidationError.set('Invalid URL. Must start with http:// or https://');
      return;
    }

    this.currentState.set('extension-mapping');
    this.errorMessage = '';
    this.session.reset();

    this.extensionSub?.unsubscribe();
    this.extensionSub = this.extensionService.openMapper(this.url.trim()).subscribe({
      next: (event) => {
        if (event.type === 'MAPPING_COMPLETE') {
          this.session.applyExtensionResult(event.payload);
          this.currentState.set('mapping');
        } else if (event.type === 'MAPPING_CANCELLED') {
          this.currentState.set('idle');
        } else if (event.type === 'MAPPING_ERROR') {
          this.currentState.set('error');
          this.errorMessage = event.payload.message;
        }
      },
      error: (err: Error) => {
        this.currentState.set('error');
        this.errorMessage = err.message;
      },
    });
  }

  cancelExtensionMapping(): void {
    this.extensionSub?.unsubscribe();
    this.extensionSub = null;
    this.currentState.set('idle');
  }

  saveRule(): void {
    if (!this.session.isSaveEnabled() || !this.url.trim()) return;

    this.currentState.set('saving');
    this.errorMessage = '';

    const hostname = this.extractHostname(this.url);
    const params: SaveDomainRuleParams = {
      hostname,
      pageTitle: this.session.pageTitle(),
      fieldMappings: this.session.fieldMappings(),
      containerSelector: this.session.containerSelector() ?? null,
      categoryId: this.selectedCategoryId() || undefined,
    };

    this.persistence.saveDomainRule(params, this.domains()).subscribe({
      next: () => {
        this.domainRuleSaved = true;
        this.savedDomain = hostname;
        this.currentState.set('done');
      },
      error: (err) => {
        this.currentState.set('error');
        this.errorMessage = err.error?.message || err.message || 'Failed to save domain rule.';
      },
    });
  }

  saveProducts(): void {
    if (this.session.extractedProducts().length === 0 || !this.url.trim()) return;

    this.savingProducts = true;
    this.ingestError = '';

    const hostname = this.extractHostname(this.url);
    const params: SaveProductsParams = {
      hostname,
      url: this.url,
      products: this.session.extractedProducts() as Record<string, unknown>[],
      fieldMappings: this.session.fieldMappings(),
      categoryId: this.selectedCategoryId() || undefined,
    };

    this.persistence.ingestProducts(params).subscribe({
      next: () => {
        this.productsIngested = true;
        this.savingProducts = false;
        this.currentState.set('done');
      },
      error: (err) => {
        this.ingestError = `Failed to ingest products: ${err.message ?? err}`;
        this.savingProducts = false;
        this.currentState.set('done');
      },
    });
  }

  saveSchedule(): void {
    if (!this.savedDomain || !this.extensionAvailable()) return;

    this.savingSchedule.set(true);
    this.scheduleError.set('');
    this.scheduleSaved.set(false);

    const intervalMinutes = Math.max(1, Math.round(this.scheduleIntervalHours() * 60));

    this.extensionService
      .setSchedule(this.savedDomain, intervalMinutes, this.scheduleEnabled())
      .then((res) => {
        if (res.ok) this.scheduleSaved.set(true);
        else this.scheduleError.set(res.error ?? 'Failed to save schedule.');
      })
      .catch((err: Error) => {
        this.scheduleError.set(err.message);
      })
      .finally(() => {
        this.savingSchedule.set(false);
      });
  }

  tryAgain(): void {
    this.currentState.set('idle');
    this.errorMessage = '';
    this.domainRuleSaved = false;
    this.productsIngested = false;
    this.savingProducts = false;
    this.ingestError = '';
    this.savedDomain = null;
    this.scheduleEnabled.set(false);
    this.scheduleSaved.set(false);
    this.scheduleError.set('');
    this.savingSchedule.set(false);
    this.session.reset();
  }

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // Computed for template
  readonly extractedProductsCount = computed(() => this.session.extractedProducts().length);
}