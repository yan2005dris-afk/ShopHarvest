import { Component, input, output, signal, HostListener } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { EtlRunDto, EtlRunFiltersDto, EtlRunListResponseDto } from '@web-scraping/contracts/pipeline';

@Component({
  selector: 'app-etl-run-detail-modal',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (run()) {
      @let r = run()!;
      <div class="modal-backdrop" (click)="onClose()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Detalle de Ejecución: {{ r.source }}</h3>
            <button class="close-btn" (click)="onClose()">×</button>
          </div>
          <div class="modal-body">
            <dl class="detail-grid">
              <dt>ID</dt><dd>{{ r.id }}</dd>
              <dt>Estado</dt><dd><span class="status-badge" [attr.data-status]="r.status">{{ r.status }}</span></dd>
              <dt>Inicio</dt><dd>{{ r.startedAt | date:'medium' }}</dd>
              <dt>Fin</dt><dd>{{ r.finishedAt ? (r.finishedAt | date:'medium') : '—' }}</dd>
              <dt>Duración</dt><dd>{{ r.durationMs ? (r.durationMs / 1000 | number:'1.1-2') + 's' : '—' }}</dd>
              <dt>Filas Extraídas</dt><dd>{{ r.rowsScraped | number }}</dd>
              <dt>Filas Persistidas</dt><dd>{{ r.rowsPersisted | number }}</dd>
              @if (r.errorSummary) {
                <dt>Error</dt><dd class="error-text">{{ r.errorSummary }}</dd>
              }
            </dl>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-content {
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--color-outline-variant);
    }
    .modal-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--color-on-surface);
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .close-btn:hover {
      color: var(--color-on-surface);
    }
    .modal-body {
      padding: 20px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 12px 16px;
      margin: 0;
    }
    .detail-grid dt {
      font-weight: 600;
      color: var(--color-on-surface-variant);
      font-size: 0.85rem;
    }
    .detail-grid dd {
      margin: 0;
      color: var(--color-on-surface);
      font-size: 0.9rem;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .status-badge[data-status="RUNNING"] {
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
      color: var(--color-primary);
    }
    .status-badge[data-status="SUCCESS"] {
      background: var(--color-success-dim);
      color: var(--color-success);
    }
    .status-badge[data-status="FAILED"] {
      background: var(--color-danger-dim);
      color: var(--color-danger);
    }
    .error-text {
      color: var(--color-danger);
    }
  `]
})
export class EtlRunDetailModalComponent {
  run = input<EtlRunDto | null>(null);
  close = output<void>();

  onClose(): void { this.close.emit(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.onClose(); }
}

@Component({
  selector: 'app-etl-runs-table',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, EtlRunDetailModalComponent],
  template: `
    <div class="filter-bar">
      <div class="filter-field">
        <label for="status">Estado</label>
        <select id="status" [(ngModel)]="statusVal">
          <option value="">Todos</option>
          <option value="RUNNING">RUNNING</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>

      <div class="filter-field">
        <label for="source">Fuente</label>
        <select id="source" [(ngModel)]="sourceVal">
          <option value="">Todas</option>
          <option value="mercadolibre">MercadoLibre</option>
          <option value="aliexpress">AliExpress</option>
          <option value="temu">Temu</option>
          <option value="shein">SHEIN</option>
          <option value="all">Todas (Lote)</option>
        </select>
      </div>

      <div class="filter-field">
        <label for="from">Desde</label>
        <input type="date" id="from" [(ngModel)]="fromVal" />
      </div>

      <div class="filter-field">
        <label for="to">Hasta</label>
        <input type="date" id="to" [(ngModel)]="toVal" />
      </div>

      <div class="filter-actions">
        <button class="btn btn-secondary" (click)="onClear()">Limpiar</button>
        <button class="btn btn-primary" (click)="onApply()">Filtrar</button>
      </div>
    </div>

    <div class="table-container">
      @if (loading()) {
        <div class="loading-overlay">
          <div class="spinner"></div>
          <span>Cargando ejecuciones...</span>
        </div>
      }

      <table class="runs-table">
        <thead>
          <tr>
            <th>Fuente</th>
            <th>Estado</th>
            <th>Inicio</th>
            <th>Duración</th>
            <th>Extraídas</th>
            <th>Persistidas</th>
          </tr>
        </thead>
        <tbody>
          @for (run of runs(); track run.id) {
            <tr
              [class.selected]="selectedRunId() === run.id"
              (click)="onRowClick(run)"
              (dblclick)="onRowDoubleClick(run)"
            >
              <td class="source-cell">{{ run.source }}</td>
              <td>
                <span class="status-badge" [attr.data-status]="run.status">{{ run.status }}</span>
              </td>
              <td>{{ run.startedAt | date:'medium' }}</td>
              <td>{{ run.durationMs ? (run.durationMs / 1000 | number:'1.1-2') + 's' : '—' }}</td>
              <td>{{ run.rowsScraped | number }}</td>
              <td>{{ run.rowsPersisted | number }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="empty-state">No se encontraron ejecuciones ETL.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (meta(); as pagination) {
      <div class="pagination-bar">
        <div class="pagination-info">
          Mostrando {{ runs().length }} de {{ pagination.total }} ejecuciones
        </div>
        <div class="pagination-controls">
          <button 
            class="btn btn-nav" 
            [disabled]="pagination.page <= 1"
            (click)="onPageChange(pagination.page - 1)"
          >
            Anterior
          </button>
          <span class="page-indicator">Página {{ pagination.page }} de {{ pagination.totalPages || 1 }}</span>
          <button 
            class="btn btn-nav" 
            [disabled]="pagination.page >= pagination.totalPages"
            (click)="onPageChange(pagination.page + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    }

    <app-etl-run-detail-modal
      [run]="detailRun()"
      (close)="onModalClose()"
    />
  `,
  styles: [`
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      margin-bottom: 20px;
      align-items: flex-end;
    }
    .filter-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-width: 150px;
    }
    .filter-field label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-on-surface-variant);
    }
    .filter-field select, .filter-field input {
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-md);
      padding: 8px 10px;
      color: var(--color-on-surface);
      font-size: 0.85rem;
      width: 100%;
    }
    .filter-actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: var(--radius-md);
      font-weight: 500;
      cursor: pointer;
      font-size: 0.85rem;
      border: none;
      transition: background-color 0.15s ease;
      white-space: nowrap;
    }
    .btn-primary {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .btn-primary:hover {
      background: var(--color-primary-container);
    }
    .btn-secondary {
      background: var(--color-surface-container);
      color: var(--color-on-surface-variant);
      border: 1px solid var(--color-outline-variant);
    }
    .btn-secondary:hover {
      background: var(--color-surface-container-high);
      color: var(--color-on-surface);
    }
    .btn-nav {
      background: var(--color-surface-container-low);
      color: var(--color-on-surface-variant);
      border: 1px solid var(--color-outline-variant);
      padding: 6px 12px;
    }
    .btn-nav:hover:not(:disabled) {
      background: var(--color-surface-container);
      color: var(--color-on-surface);
    }
    .btn-nav:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .table-container {
      position: relative;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--color-surface-container);
      opacity: 0.85;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 12px;
      z-index: 10;
      color: var(--color-on-surface);
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid var(--color-outline-variant);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .runs-table {
      width: 100%;
      border-collapse: collapse;
    }
    .runs-table th {
      text-align: left;
      padding: 12px 16px;
      background: var(--color-surface-container);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--color-outline-variant);
    }
    .runs-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      font-size: 0.9rem;
    }
    .runs-table tbody tr {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .runs-table tbody tr:hover {
      background: var(--color-surface-container);
    }
    .runs-table tbody tr.selected {
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    }
    .runs-table tbody tr:last-child td {
      border-bottom: none;
    }
    .source-cell {
      font-weight: 500;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .status-badge[data-status="RUNNING"] {
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
      color: var(--color-primary);
    }
    .status-badge[data-status="SUCCESS"] {
      background: var(--color-success-dim);
      color: var(--color-success);
    }
    .status-badge[data-status="FAILED"] {
      background: var(--color-danger-dim);
      color: var(--color-danger);
    }
    .empty-state {
      text-align: center;
      color: var(--color-on-surface-variant);
      padding: 32px;
    }
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      margin-top: 16px;
      font-size: 0.85rem;
      color: var(--color-on-surface-variant);
    }
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `]
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
