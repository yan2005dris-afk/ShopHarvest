import { Component, computed, effect, input, output, signal, HostListener } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface EtlSourceOption {
  code: string;
  label: string;
}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [MatCardModule, MatRadioModule, MatCheckboxModule, MatButtonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        (click)="onCancel()"
        data-testid="modal-backdrop"
      >
        <mat-card
          appearance="outlined"
          class="mx-4 flex w-full max-w-md flex-col !p-0 shadow-2xl"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          data-testid="modal-content"
        >
          <header
            class="flex items-center justify-between border-b border-outline-variant px-4 py-4"
          >
            <h3 class="m-0 text-headline-sm font-semibold">{{ title() }}</h3>
            <button mat-icon-button aria-label="Cerrar" (click)="onCancel()">
              <mat-icon>close</mat-icon>
            </button>
          </header>

          <div class="space-y-4 px-4 py-5 text-body-md leading-relaxed">
            <p>{{ message() }}</p>

            <div class="flex flex-col gap-2">
              <span class="text-label-caps text-on-surface-variant">Tipo de Ejecución</span>
              <mat-radio-group
                [value]="action()"
                (change)="onActionChange($event.value)"
                class="flex flex-col gap-2"
              >
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
                  [class.border-outline-variant]="action() !== 'full'"
                  [class.bg-surface-container-low]="action() !== 'full'"
                  [class.border-primary]="action() === 'full'"
                  [class.bg-primary-fixed]="action() === 'full'"
                >
                  <mat-radio-button value="full" class="mt-1">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-body-md font-medium text-on-surface"
                        >Pipeline Completo</span
                      >
                      <span class="text-body-sm text-on-surface-variant">
                        Scraping por navegador + ETL sobre las fuentes
                        {{ preselectedSources().length > 0 ? 'seleccionadas' : 'disponibles' }}
                      </span>
                    </div>
                  </mat-radio-button>
                </label>
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
                  [class.border-outline-variant]="action() !== 'local'"
                  [class.bg-surface-container-low]="action() !== 'local'"
                  [class.border-primary]="action() === 'local'"
                  [class.bg-primary-fixed]="action() === 'local'"
                >
                  <mat-radio-button value="local" class="mt-1">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-body-md font-medium text-on-surface">ETL Local</span>
                      <span class="text-body-sm text-on-surface-variant">
                        Procesar solo las capturas pendientes de la base de datos (scraper local)
                      </span>
                    </div>
                  </mat-radio-button>
                </label>
              </mat-radio-group>
            </div>

            <div class="flex flex-col gap-1.5 text-left">
              <label class="text-label-caps text-on-surface-variant">
                {{ action() === 'full' ? 'Fuentes a Scraping' : 'Fuentes a Procesar' }}
              </label>
              <div
                class="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-low p-3"
              >
                @for (opt of availableSources(); track opt.code) {
                  <label
                    class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-container"
                  >
                    <mat-checkbox
                      [checked]="selectedSources().has(opt.code)"
                      (change)="toggleSource(opt.code)"
                    ></mat-checkbox>
                    <span class="text-body-md text-on-surface">{{ opt.label }}</span>
                  </label>
                }
              </div>
              @if (selectedSources().size === 0) {
                <span class="mt-1 text-body-md text-danger">
                  Seleccioná al menos una fuente para continuar
                </span>
              } @else {
                <span class="mt-1 text-body-md text-on-surface-variant">
                  Seleccionadas: {{ selectedSourcesLabel() }}
                </span>
              }
            </div>
          </div>

          <footer class="flex justify-end gap-2.5 border-t border-outline-variant px-4 py-3">
            <button mat-stroked-button (click)="onCancel()" data-testid="btn-cancel">
              {{ cancelText() }}
            </button>
            <button
              mat-flat-button
              color="primary"
              [disabled]="selectedSources().size === 0"
              (click)="onConfirm()"
              data-testid="btn-confirm"
            >
              {{ confirmText() }}
            </button>
          </footer>
        </mat-card>
      </div>
    }
  `,
  styles: [
    `
      /* Fade-in animation when the source list re-renders on action change */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      :host > div,
      :host > div > div {
        animation: fadeIn 200ms ease-out;
      }
    `,
  ],
})
export class ConfirmModalComponent {
  title = input<string>('Confirm Action');
  message = input<string>('Are you sure you want to proceed?');
  confirmText = input<string>('Confirm');
  cancelText = input<string>('Cancel');
  isOpen = input<boolean>(false);
  pendingSources = input<EtlSourceOption[]>([]);
  /**
   * Optional pre-selected (page-card) source options. When non-empty,
   * the effective source list is restricted to exactly these for BOTH
   * actions, and they are pre-selected. When empty, the legacy
   * behavior applies (full SCRAPING_SOURCES for `full`, pending for
   * `local`, all pre-selected).
   */
  preselectedSources = input<EtlSourceOption[]>([]);

  confirm = output<{ action: 'full' | 'local'; source: string }>();
  cancel = output<void>();

  action = signal<'full' | 'local'>('full');
  selectedSources = signal<Set<string>>(new Set());

  private readonly SCRAPING_SOURCES: EtlSourceOption[] = [
    { code: 'mercadolibre', label: 'MercadoLibre' },
    { code: 'aliexpress', label: 'AliExpress' },
    { code: 'temu', label: 'Temu' },
    { code: 'shein', label: 'SHEIN' },
  ];

  readonly availableSources = computed<EtlSourceOption[]>(() => {
    const preselected = this.preselectedSources();
    if (preselected.length > 0) {
      // Opening scoped by page-card selection: restrict to exactly
      // those codes for both actions. For `local` we keep only the
      // preselected codes that also appear in pendingSources, falling
      // back to the full preselection when none match — but never
      // widen beyond it.
      if (this.action() === 'full') return preselected;
      const pendingCodes = new Set(this.pendingSources().map((o) => o.code));
      const matched = preselected.filter((o) => pendingCodes.has(o.code));
      return matched.length > 0 ? matched : preselected;
    }
    return this.action() === 'local' ? this.pendingSources() : this.SCRAPING_SOURCES;
  });

  readonly selectedSourcesLabel = computed<string>(() => {
    const selected = this.selectedSources();
    const opts = this.availableSources();
    const labels = opts.filter((o) => selected.has(o.code)).map((o) => o.label);
    return labels.join(', ');
  });

  constructor() {
    // Pre-select all sources only on the false→true transition so
    // imperative state changes (e.g. unchecking all sources) stick
    // and tests don't fight an effect that keeps re-seeding.
    let wasOpen = false;
    effect(() => {
      const isOpen = this.isOpen();
      if (isOpen && !wasOpen) {
        // If the modal was opened scoped by page-card selection, lead
        // with the local (scraper local) action over exactly those
        // sources; otherwise default to the full pipeline.
        const preselect = this.preselectedSources();
        this.action.set(preselect.length > 0 ? 'local' : 'full');
        this.selectedSources.set(new Set(this.availableSources().map((o) => o.code)));
      }
      wasOpen = isOpen;
    });
  }

  toggleSource(code: string): void {
    this.selectedSources.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }

  onConfirm(): void {
    if (this.selectedSources().size === 0) return;

    const selectedCodes = Array.from(this.selectedSources());
    // `source: 'all'` means "the full pipeline across every known
    // scrape source" — emitted only when the selection covers the
    // whole SCRAPING_SOURCES set, regardless of how the list was
    // narrowed (preselection or action). Otherwise emit the explicit
    // comma-joined codes.
    const known = new Set(this.SCRAPING_SOURCES.map((o) => o.code));
    const sourceStr =
      selectedCodes.length === known.size && selectedCodes.every((c) => known.has(c))
        ? 'all'
        : selectedCodes.join(',');

    this.confirm.emit({
      action: this.action(),
      source: sourceStr,
    });

    this.selectedSources.set(new Set());
  }

  onCancel(): void {
    this.selectedSources.set(new Set());
    this.cancel.emit();
  }

  onActionChange(val: 'full' | 'local'): void {
    this.action.set(val);
    // Re-seed selection to whatever the new source list contains.
    this.selectedSources.set(new Set(this.availableSources().map((o) => o.code)));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onCancel();
    }
  }
}
