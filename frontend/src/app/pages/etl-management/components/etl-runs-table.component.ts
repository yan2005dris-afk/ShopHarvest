import { Component, input, output, signal, HostListener } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type {
  EtlRunDto,
  EtlRunFiltersDto,
  EtlRunListResponseDto,
} from '@web-scraping/contracts/pipeline';
import {
  DateRangePickerComponent,
  fromIsoDate,
  toIsoDate,
} from '../../../shared/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-etl-run-detail-modal',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (run()) {
      @let r = run()!;
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="onClose()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="etl-modal-title"
      >
        <div
          class="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low max-h-[85vh]"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between border-b border-outline-variant px-5 py-4">
            <h3 id="etl-modal-title" class="m-0 text-headline-sm font-bold text-on-surface">
              Detalle de Ejecución: {{ r.source }}
            </h3>
            <button
              type="button"
              class="flex cursor-pointer items-center rounded-md border border-outline-variant bg-transparent px-2.5 py-1 text-body-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              (click)="onClose()"
              aria-label="Cerrar modal"
            >
              <span class="material-symbols-outlined" style="font-size: 18px">close</span>
            </button>
          </div>
          <div class="overflow-y-auto p-5">
            <dl class="m-0 grid grid-cols-[130px_1fr] gap-x-4 gap-y-3 text-body-md">
              <dt class="font-semibold text-on-surface-variant">ID</dt>
              <dd class="m-0 font-mono text-on-surface break-all">{{ r.id }}</dd>
              <dt class="font-semibold text-on-surface-variant">Estado</dt>
              <dd class="m-0">
                <span
                  class="rounded-xs px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase"
                  [class.bg-primary-fixed]="r.status === 'RUNNING'"
                  [class.text-primary-container]="r.status === 'RUNNING'"
                  [class.bg-success-dim]="r.status === 'SUCCESS'"
                  [class.text-success]="r.status === 'SUCCESS'"
                  [class.bg-danger-dim]="r.status === 'FAILED'"
                  [class.text-danger]="r.status === 'FAILED'"
                  [attr.data-status]="r.status"
                >
                  {{ r.status }}
                </span>
              </dd>
              <dt class="font-semibold text-on-surface-variant">Inicio</dt>
              <dd class="m-0 text-on-surface">{{ r.startedAt | date: 'medium' }}</dd>
              <dt class="font-semibold text-on-surface-variant">Fin</dt>
              <dd class="m-0 text-on-surface">
                {{ r.finishedAt ? (r.finishedAt | date: 'medium') : '—' }}
              </dd>
              <dt class="font-semibold text-on-surface-variant">Duración</dt>
              <dd class="m-0 text-on-surface">
                {{ r.durationMs ? (r.durationMs / 1000 | number: '1.1-2') + 's' : '—' }}
              </dd>
              <dt class="font-semibold text-on-surface-variant">Filas Extraídas</dt>
              <dd class="m-0 font-semibold text-on-surface">{{ r.rowsScraped | number }}</dd>
              <dt class="font-semibold text-on-surface-variant">Filas Persistidas</dt>
              <dd class="m-0 font-semibold text-on-surface">{{ r.rowsPersisted | number }}</dd>
              @if (r.errorSummary) {
                <dt class="font-semibold text-danger">Error</dt>
                <dd class="m-0 font-mono text-danger break-words">{{ r.errorSummary }}</dd>
              }
            </dl>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class EtlRunDetailModalComponent {
  run = input<EtlRunDto | null>(null);
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onClose();
  }
}

@Component({
  selector: 'app-etl-runs-table',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    EtlRunDetailModalComponent,
    DateRangePickerComponent,
  ],
  template: `
    <div
      class="mb-5 flex flex-wrap items-end gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4"
    >
      <div class="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <label for="status" class="text-label-caps font-semibold text-on-surface-variant uppercase"
          >Estado</label
        >
        <select
          id="status"
          [(ngModel)]="statusVal"
          class="w-full rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-body-md text-on-surface outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos</option>
          <option value="RUNNING">RUNNING</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>

      <div class="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <label for="source" class="text-label-caps font-semibold text-on-surface-variant uppercase"
          >Fuente</label
        >
        <select
          id="source"
          [(ngModel)]="sourceVal"
          class="w-full rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-body-md text-on-surface outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary"
        >
          <option value="">Todas</option>
          <option value="mercadolibre">MercadoLibre</option>
          <option value="aliexpress">AliExpress</option>
          <option value="temu">Temu</option>
          <option value="shein">SHEIN</option>
          <option value="all">Todas (Lote)</option>
        </select>
      </div>

      <div class="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <label for="from" class="text-label-caps font-semibold text-on-surface-variant uppercase"
          >Desde</label
        >
        <app-date-range-picker
          id="from"
          [value]="fromDate"
          (dateChange)="onFromDateChange($event)"
          ariaLabel="Fecha desde"
        />
      </div>

      <div class="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <label for="to" class="text-label-caps font-semibold text-on-surface-variant uppercase"
          >Hasta</label
        >
        <app-date-range-picker
          id="to"
          [value]="toDate"
          (dateChange)="onToDateChange($event)"
          ariaLabel="Fecha hasta"
        />
      </div>

      <div class="flex items-center gap-2.5">
        <button
          type="button"
          class="cursor-pointer rounded-md border border-outline-variant bg-surface-container px-4 py-2 text-body-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          (click)="onClear()"
        >
          Limpiar
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md bg-primary px-4 py-2 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-container"
          (click)="onApply()"
        >
          Filtrar
        </button>
      </div>
    </div>

    <div
      class="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
    >
      @if (loading()) {
        <div
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-container/85 text-body-md text-on-surface"
        >
          <div
            class="size-7 rounded-full border-3 border-outline-variant border-t-primary"
            style="animation: spin 0.8s linear infinite"
          ></div>
          <span>Cargando ejecuciones...</span>
        </div>
      }

      <table class="w-full border-collapse text-body-md">
        <thead>
          <tr class="bg-surface-container">
            <th
              class="border-b border-outline-variant px-4 py-3 text-left text-label-caps font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Fuente
            </th>
            <th
              class="border-b border-outline-variant px-4 py-3 text-left text-label-caps font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Estado
            </th>
            <th
              class="border-b border-outline-variant px-4 py-3 text-left text-label-caps font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Inicio
            </th>
            <th
              class="border-b border-outline-variant px-4 py-3 text-left text-label-caps font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Duración
            </th>
            <th
              class="border-b border-outline-variant px-4 py-3 text-right text-label-caps font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Extraídas
            </th>
            <th
              class="border-b border-outline-variant px-4 py-3 text-right text-label-caps font-semibold tracking-wider text-on-surface-variant uppercase"
            >
              Persistidas
            </th>
          </tr>
        </thead>
        <tbody>
          @for (run of runs(); track run.id) {
            <tr
              class="cursor-pointer border-b border-outline-variant transition-colors hover:bg-surface-container last:border-b-0"
              [class.bg-primary-fixed/20]="selectedRunId() === run.id"
              (click)="onRowClick(run)"
              (dblclick)="onRowDoubleClick(run)"
            >
              <td class="px-4 py-3 font-medium text-on-surface">{{ run.source }}</td>
              <td class="px-4 py-3">
                <span
                  class="rounded-xs px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase"
                  [class.bg-primary-fixed]="run.status === 'RUNNING'"
                  [class.text-primary-container]="run.status === 'RUNNING'"
                  [class.bg-success-dim]="run.status === 'SUCCESS'"
                  [class.text-success]="run.status === 'SUCCESS'"
                  [class.bg-danger-dim]="run.status === 'FAILED'"
                  [class.text-danger]="run.status === 'FAILED'"
                  [attr.data-status]="run.status"
                >
                  {{ run.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-on-surface-variant">
                {{ run.startedAt | date: 'medium' }}
              </td>
              <td class="px-4 py-3 text-on-surface-variant">
                {{ run.durationMs ? (run.durationMs / 1000 | number: '1.1-2') + 's' : '—' }}
              </td>
              <td class="px-4 py-3 text-right font-medium text-on-surface">
                {{ run.rowsScraped | number }}
              </td>
              <td class="px-4 py-3 text-right font-medium text-on-surface">
                {{ run.rowsPersisted | number }}
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="p-8 text-center text-body-md text-on-surface-variant">
                No se encontraron ejecuciones ETL.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (meta(); as pagination) {
      <div class="mt-4 flex items-center justify-between px-2 text-body-md text-on-surface-variant">
        <div>Mostrando {{ runs().length }} de {{ pagination.total }} ejecuciones</div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="cursor-pointer rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-body-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
            [disabled]="pagination.page <= 1"
            (click)="onPageChange(pagination.page - 1)"
          >
            Anterior
          </button>
          <span class="text-body-md font-medium text-on-surface"
            >Página {{ pagination.page }} de {{ pagination.totalPages || 1 }}</span
          >
          <button
            type="button"
            class="cursor-pointer rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-body-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
            [disabled]="pagination.page >= pagination.totalPages"
            (click)="onPageChange(pagination.page + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    }

    <app-etl-run-detail-modal [run]="detailRun()" (close)="onModalClose()" />
  `,
  styles: [
    `
      :host {
        display: block;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class EtlRunsTableComponent {
  runs = input<EtlRunDto[]>([]);
  meta = input<EtlRunListResponseDto['meta'] | null>(null);
  selectedRunId = input<string | undefined>(undefined);
  loading = input<boolean>(false);

  pageChange = output<number>();
  rowSelect = output<EtlRunDto>();
  rowDoubleClick = output<EtlRunDto>();
  filterChange = output<EtlRunFiltersDto>();

  detailRun = signal<EtlRunDto | null>(null);

  statusVal = '';
  sourceVal = '';
  fromVal = '';
  toVal = '';

  private _fromDate: Date | null = null;
  private _fromKey = '';
  private _toDate: Date | null = null;
  private _toKey = '';

  /** Cached Date parsed from `fromVal` — stable reference across CD so the
   *  datepicker input isn't reformatted mid-typing. Only re-parses when the
   *  underlying ISO string changes. */
  get fromDate(): Date | null {
    if (this._fromKey !== this.fromVal) {
      this._fromKey = this.fromVal;
      this._fromDate = fromIsoDate(this.fromVal);
    }
    return this._fromDate;
  }

  get toDate(): Date | null {
    if (this._toKey !== this.toVal) {
      this._toKey = this.toVal;
      this._toDate = fromIsoDate(this.toVal);
    }
    return this._toDate;
  }

  onFromDateChange(date: Date | null): void {
    this.fromVal = toIsoDate(date);
  }

  onToDateChange(date: Date | null): void {
    this.toVal = toIsoDate(date);
  }

  onApply(): void {
    const filters: EtlRunFiltersDto = {};
    if (this.statusVal) filters.status = this.statusVal as any;
    if (this.sourceVal) filters.source = this.sourceVal;
    if (this.fromVal) filters.from = this.fromVal;
    if (this.toVal) filters.to = this.toVal;
    this.filterChange.emit(filters);
  }

  onClear(): void {
    this.statusVal = '';
    this.sourceVal = '';
    this.fromVal = '';
    this.toVal = '';
    this.filterChange.emit({});
  }

  onRowClick(run: EtlRunDto): void {
    this.rowSelect.emit(run);
  }

  onRowDoubleClick(run: EtlRunDto): void {
    this.detailRun.set(run);
    this.rowDoubleClick.emit(run);
  }

  onModalClose(): void {
    this.detailRun.set(null);
  }

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }
}
