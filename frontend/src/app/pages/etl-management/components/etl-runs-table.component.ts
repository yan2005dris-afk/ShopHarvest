import { Component, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { EtlRunDto, EtlRunFiltersDto, EtlRunListResponseDto } from '@web-scraping/contracts/pipeline';

@Component({
  selector: 'app-etl-runs-table',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
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
            >
              <td>
                <span class="source-text">{{ run.source }}</span>
              </td>
              <td>
                <span class="status-badge" [attr.data-status]="run.status">
                  {{ run.status }}
                </span>
              </td>
              <td>{{ run.startedAt | date:'short' }}</td>
              <td>
                {{ run.durationMs ? (run.durationMs / 1000 | number:'1.1-2') + 's' : '—' }}
              </td>
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
  `,
  styles: [`
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px;
      background: var(--bg-card, #1e1e2d);
      border: 1px solid var(--border-color, #2d2d3f);
      border-radius: 8px;
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
      color: var(--text-secondary, #a1a5b7);
    }
    .filter-field select, .filter-field input {
      background: var(--bg-body, #151521);
      border: 1px solid var(--border-color, #2d2d3f);
      border-radius: 4px;
      padding: 8px 10px;
      color: var(--text-primary, #ffffff);
      font-size: 0.85rem;
      width: 100%;
    }
    .filter-actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      font-size: 0.85rem;
      border: none;
      transition: background-color 0.15s ease;
      white-space: nowrap;
    }
    .btn-primary {
      background: #3699ff;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #187de4;
    }
    .btn-secondary {
      background: var(--bg-body, #151521);
      color: var(--text-secondary, #a1a5b7);
      border: 1px solid var(--border-color, #2d2d3f);
    }
    .btn-secondary:hover {
      background: var(--border-color, #2d2d3f);
      color: var(--text-primary, #ffffff);
    }
    .btn-nav {
      background: var(--bg-card, #1e1e2d);
      color: var(--text-secondary, #a1a5b7);
      border: 1px solid var(--border-color, #2d2d3f);
      padding: 6px 12px;
    }
    .btn-nav:hover:not(:disabled) {
      background: var(--border-color, #2d2d3f);
      color: var(--text-primary, #ffffff);
    }
    .btn-nav:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .table-container {
      position: relative;
      background: var(--bg-card, #1e1e2d);
      border: 1px solid var(--border-color, #2d2d3f);
      border-radius: 8px;
      overflow-x: auto;
    }
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(21, 21, 33, 0.7);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 12px;
      z-index: 10;
      color: var(--text-primary, #ffffff);
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(54, 153, 255, 0.2);
      border-top-color: #3699ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .runs-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }
    .runs-table th {
      background: rgba(255, 255, 255, 0.01);
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #2d2d3f);
      color: var(--text-secondary, #a1a5b7);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
    }
    .runs-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #2d2d3f);
      color: var(--text-primary, #ffffff);
    }
    .runs-table tbody tr {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .runs-table tbody tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    .runs-table tbody tr.selected {
      background: rgba(54, 153, 255, 0.08);
      border-left: 3px solid #3699ff;
    }
    .source-text {
      font-weight: 500;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .status-badge[data-status="RUNNING"] {
      background: rgba(54, 153, 255, 0.15);
      color: #3699ff;
    }
    .status-badge[data-status="SUCCESS"] {
      background: rgba(26, 188, 156, 0.15);
      color: #1abc9c;
    }
    .status-badge[data-status="FAILED"] {
      background: rgba(246, 78, 96, 0.15);
      color: #f64e60;
    }
    .empty-state {
      text-align: center;
      color: var(--text-secondary, #a1a5b7);
      padding: 32px !important;
    }
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      margin-top: 16px;
      font-size: 0.85rem;
      color: var(--text-secondary, #a1a5b7);
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
  filterChange = output<EtlRunFiltersDto>();

  // Filter model values
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

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }
}
