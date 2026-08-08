import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';

import { EtlManagementStore } from './etl-management.store';
import { ConfirmModalComponent, EtlSourceOption } from './components/confirm-modal.component';
import { EtlLoadPreviewComponent } from './components/etl-load-preview.component';
import { EtlRunsTableComponent } from './components/etl-runs-table.component';

/**
 * EtlManagementPage — operator surface for monitoring and manually
 * triggering ETL runs.
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
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
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
            mat-flat-button
            color="primary"
            [disabled]="store.loading()"
            [title]="
              selectedPendingSources().size === 0
                ? 'Ejecutar ETL del pipeline completo'
                : 'Ejecutar ETL'
            "
            [attr.aria-label]="
              selectedPendingSources().size === 0
                ? 'Ejecutar ETL del pipeline completo'
                : 'Ejecutar ETL para las fuentes seleccionadas'
            "
            (click)="onOpenTriggerModal()"
            data-testid="btn-trigger"
          >
            <mat-icon>play_arrow</mat-icon>
            <span>Ejecutar ETL</span>
          </button>
        </div>
      </header>

      @if (store.error(); as err) {
        <div
          class="flex items-center gap-3 rounded-md border border-outline-variant bg-danger-dim p-3 text-body-md text-danger relative"
          role="alert"
        >
          <mat-icon class="!size-5 text-danger" aria-hidden="true">error</mat-icon>
          <div><strong>Error:</strong> {{ err }}</div>
          <button
            mat-icon-button
            class="!absolute !right-2 !top-1/2 !-translate-y-1/2"
            (click)="store.clearError()"
            aria-label="Cerrar alerta"
          >
            <mat-icon>close</mat-icon>
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
              <mat-chip-set>
                <mat-chip
                  [class.bg-success-dim]="selectedPendingSources().size === 0"
                  [class.text-success]="selectedPendingSources().size === 0"
                  [class.bg-warning-dim]="selectedPendingSources().size > 0"
                  [class.text-warning]="selectedPendingSources().size > 0"
                  [attr.data-state]="selectedPendingSources().size === 0 ? 'full' : 'scoped'"
                >
                  {{
                    selectedPendingSources().size === 0
                      ? 'Pipeline completo'
                      : selectedPendingSources().size +
                        ' de ' +
                        pending.total +
                        ' fuentes seleccionadas'
                  }}
                </mat-chip>
              </mat-chip-set>
            </div>
          </header>
          <div
            class="grid gap-4"
            style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))"
          >
            @for (item of pending.sources | keyvalue; track item.key) {
              <label
                class="group flex cursor-pointer gap-3 rounded-md border p-4 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
                [class.border-outline-variant]="!selectedPendingSources().has(toKey(item.key))"
                [class.bg-surface-container-low]="!selectedPendingSources().has(toKey(item.key))"
                [class.border-primary]="selectedPendingSources().has(toKey(item.key))"
                [class.bg-primary-fixed]="selectedPendingSources().has(toKey(item.key))"
                [attr.data-selected]="selectedPendingSources().has(toKey(item.key))"
              >
                <mat-checkbox
                  class="mt-0.5"
                  [checked]="selectedPendingSources().has(toKey(item.key))"
                  (change)="togglePendingSource(toKey(item.key))"
                ></mat-checkbox>
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
              </label>
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
        [preselectedSources]="modalPreselectedSources()"
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
  modalPreselectedSources = signal<EtlSourceOption[]>([]);

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
    const summary = this.store.pendingSummary() as
      | { sources: Record<string, { name: string; pending: number }> }
      | null
      | undefined;
    const selected: EtlSourceOption[] = Array.from(this.selectedPendingSources()).map((code) => ({
      code,
      label: summary?.sources?.[code]?.name ?? code,
    }));
    this.modalPreselectedSources.set(selected);
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
