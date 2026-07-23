import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { EtlManagementStore } from './etl-management.store';
import { ConfirmModalComponent, EtlSourceOption } from './components/confirm-modal.component';
import { EtlLoadPreviewComponent } from './components/etl-load-preview.component';
import { EtlRunsTableComponent } from './components/etl-runs-table.component';
import { KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * EtlManagementPage — operator surface for monitoring and manually
 * triggering ETL runs.
 *
 * Sprint 4: tokens migrated to Insight Flow (Material 3 + Tailwind v4
 * utility classes). The page keeps all logic intact — only the
 * template/styling changes. Components imported below still consume
 * legacy tokens and will be migrated in subsequent sprints.
 */
@Component({
  selector: 'app-etl-management-page',
  standalone: true,
  imports: [
    ConfirmModalComponent,
    EtlLoadPreviewComponent,
    EtlRunsTableComponent,
    KeyValuePipe,
    FormsModule,
  ],
  template: `
    <div class="flex flex-col gap-5 p-6">
      <header class="flex items-center justify-between">
        <div>
          <h2 class="text-headline-md mb-1 m-0 font-bold text-on-surface">
            Gestión de Pipeline ETL
          </h2>
          <p class="text-body-md m-0 text-on-surface-variant">
            Monitoreo y ejecución manual de procesos de extracción y carga
          </p>
        </div>
        <div>
          <button
            type="button"
            class="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
            [disabled]="store.loading() || selectedPendingSources().size === 0"
            [title]="
              selectedPendingSources().size === 0
                ? 'Seleccioná fuentes pendientes para ejecutar'
                : 'Ejecutar ETL'
            "
            (click)="onOpenTriggerModal()"
            data-testid="btn-trigger"
          >
            <span class="material-symbols-outlined" style="font-size: 18px">play_arrow</span>
            <span>Ejecutar ETL</span>
          </button>
        </div>
      </header>

      @if (store.error(); as err) {
        <div
          class="flex items-center gap-3 rounded-md border border-outline-variant bg-danger-dim p-3 text-body-md text-danger relative"
          role="alert"
        >
          <span class="material-symbols-outlined" style="font-size: 20px" aria-hidden="true"
            >error</span
          >
          <div><strong>Error:</strong> {{ err }}</div>
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-danger transition-colors hover:bg-danger-dim"
            (click)="store.clearError()"
            aria-label="Cerrar alerta"
          >
            <span class="material-symbols-outlined" style="font-size: 18px">close</span>
          </button>
        </div>
      }

      <!-- Pending Queue Summary with Multi-Select -->
      @if (store.pendingSummary(); as pending) {
        <section
          class="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface p-5"
          aria-label="Lotes pendientes"
        >
          <header class="flex items-center justify-between">
            <h3 class="text-headline-sm m-0 font-semibold text-on-surface">
              Lotes de Ingesta Pendientes
            </h3>
            <div class="flex items-center gap-3">
              <span
                class="rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase"
                [class.bg-success-dim]="pending.total === 0"
                [class.text-success]="pending.total === 0"
                [class.bg-warning-dim]="pending.total > 0"
                [class.text-warning]="pending.total > 0"
              >
                {{ selectedPendingSources().size }} de {{ pending.total }} items seleccionados
              </span>
            </div>
          </header>
          <div
            class="grid gap-4"
            style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))"
          >
            @for (item of pending.sources | keyvalue; track item.key) {
              <div
                class="flex cursor-pointer gap-3 rounded-md border p-4 transition-all"
                [class.border-outline-variant]="!selectedPendingSources().has(toKey(item.key))"
                [class.bg-surface-container-low]="!selectedPendingSources().has(toKey(item.key))"
                [class.border-primary]="selectedPendingSources().has(toKey(item.key))"
                [class.bg-primary-fixed]="selectedPendingSources().has(toKey(item.key))"
                (click)="togglePendingSource(toKey(item.key))"
              >
                <div class="flex items-start pt-0.5">
                  <input
                    type="checkbox"
                    class="size-4.5 cursor-pointer accent-primary"
                    [checked]="selectedPendingSources().has(toKey(item.key))"
                    (click)="$event.stopPropagation()"
                    (change)="togglePendingSource(toKey(item.key))"
                  />
                </div>
                <div class="flex flex-1 flex-col gap-3">
                  <div class="flex items-baseline justify-between">
                    <span class="text-body-md font-semibold text-on-surface">{{
                      item.value.name
                    }}</span>
                    <span
                      class="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase"
                      >{{ item.key }}</span
                    >
                  </div>
                  <div class="flex gap-6">
                    <div class="flex flex-col gap-1">
                      <span class="text-label-caps text-on-surface-variant">Nuevos</span>
                      <span class="text-xl font-bold text-on-surface">{{
                        item.value.pending
                      }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-label-caps text-on-surface-variant">Fallidos</span>
                      <span
                        class="text-xl font-bold text-on-surface"
                        [class.text-danger]="item.value.failed > 0"
                        >{{ item.value.failed }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      }

      <div class="flex flex-col gap-5">
        <!-- Live SSE stream panel -->
        <app-etl-load-preview [run]="store.selectedRun()" />

        <!-- Paginated Runs Table -->
        <app-etl-runs-table
          [runs]="store.runs()"
          [meta]="store.meta()"
          [selectedRunId]="store.selectedRun()?.id"
          [loading]="store.loading()"
          (pageChange)="store.setPage($event)"
          (rowSelect)="store.selectRun($event)"
          (rowDoubleClick)="onRunDoubleClick($event)"
          (filterChange)="store.setFilters($event)"
        />
      </div>

      <!-- Trigger ETL confirm modal -->
      <app-confirm-modal
        [isOpen]="isConfirmOpen()"
        [pendingSources]="pendingSourceOptions()"
        title="Ejecutar Pipeline ETL"
        message="¿Estás seguro de iniciar la ejecución manual del pipeline ETL? Podés elegir procesar solo las capturas pendientes de la base de datos (ETL Local) o ejecutar el Scraping completo mediante navegadores."
        confirmText="Iniciar Ejecución"
        cancelText="Cancelar"
        (confirm)="onConfirmTrigger($event)"
        (cancel)="onCancelTrigger()"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class EtlManagementPage implements OnInit {
  readonly store = inject(EtlManagementStore);

  isConfirmOpen = signal<boolean>(false);
  selectedPendingSources = signal<Set<string>>(new Set());

  readonly pendingSourceOptions = computed<EtlSourceOption[]>(() => {
    const summary = this.store.pendingSummary() as
      | { sources: Record<string, { name: string; pending: number }> }
      | null
      | undefined;
    if (!summary) return [];
    return Object.entries(summary.sources)
      .filter(([, info]) => info.pending > 0)
      .map(([code, info]) => ({ code, label: info.name }));
  });

  ngOnInit(): void {
    this.store.loadRuns();
  }

  togglePendingSource(code: string): void {
    this.selectedPendingSources.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }

  toKey(value: string | number | symbol): string {
    return String(value);
  }

  onRunDoubleClick(run: any): void {
    this.store.selectRun(run);
  }

  onOpenTriggerModal(): void {
    this.isConfirmOpen.set(true);
  }

  onConfirmTrigger(evt: { action: 'full' | 'local'; source: string }): void {
    this.isConfirmOpen.set(false);

    if (evt.action === 'local' && evt.source === 'all') {
      evt = {
        ...evt,
        source: Array.from(this.selectedPendingSources()).join(','),
      };
    }

    this.store.triggerRun(evt);
  }

  onCancelTrigger(): void {
    this.isConfirmOpen.set(false);
  }
}
export default EtlManagementPage;
