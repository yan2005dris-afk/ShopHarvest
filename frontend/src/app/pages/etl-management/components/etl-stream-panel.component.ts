import { Component, input, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

export interface StreamedProduct {
  seq: number;
  producto: string;
  precio: string;
  fuente: string;
  estado: string;
}

@Component({
  selector: 'app-etl-stream-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (run(); as selectedRun) {
      <div class="stream-panel" [class.collapsed]="collapsed()">
        <div class="panel-header" (click)="toggleCollapse()">
          <div class="header-left">
            <span class="pulse-indicator" [class.active]="selectedRun.status === 'RUNNING'"></span>
            <h4>Detalle de Ejecución: {{ selectedRun.source }}</h4>
            <span class="status-badge" [attr.data-status]="selectedRun.status">
              {{ selectedRun.status }}
            </span>
          </div>
          <div class="header-right">
            @if (selectedRun.status === 'RUNNING' && streamActive()) {
              <span class="transfer-count">{{ streamedProducts().length }} transferidos</span>
            }
            <button class="collapse-btn">
              {{ collapsed() ? '▲ Mostrar' : '▼ Contraer' }}
            </button>
          </div>
        </div>

        @if (!collapsed()) {
          <div class="panel-body">
            @if (selectedRun.status === 'RUNNING' && streamActive()) {
              <div class="stream-indicator">
                <div class="spinner-small"></div>
                <span>Transfiriendo...</span>
              </div>
              
              <div class="product-table-container">
                <table class="product-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Precio</th>
                      <th>Fuente</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (product of streamedProducts(); track product.seq) {
                      <tr>
                        <td class="seq-col">{{ product.seq }}</td>
                        <td class="product-col">{{ product.producto }}</td>
                        <td class="price-col">{{ product.precio }}</td>
                        <td class="source-col">{{ product.fuente }}</td>
                        <td class="status-col">
                          <span class="product-status" [attr.data-estado]="product.estado">
                            {{ product.estado }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="metric-grid">
                <div class="metric-card">
                  <span class="metric-label">Filas Extraídas</span>
                  <span class="metric-value">{{ selectedRun.rowsScraped | number }}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-label">Filas Persistidas</span>
                  <span class="metric-value">{{ selectedRun.rowsPersisted | number }}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-label">Duración</span>
                  <span class="metric-value">
                    {{ selectedRun.durationMs ? (selectedRun.durationMs / 1000 | number:'1.1-2') + 's' : 'En progreso...' }}
                  </span>
                </div>
              </div>

              <div class="detail-list">
                <div class="detail-item">
                  <span class="label">ID de Ejecución:</span>
                  <span class="value">{{ selectedRun.id }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Inicio:</span>
                  <span class="value">{{ selectedRun.startedAt | date:'medium' }}</span>
                </div>
                @if (selectedRun.finishedAt) {
                  <div class="detail-item">
                    <span class="label">Fin:</span>
                    <span class="value">{{ selectedRun.finishedAt | date:'medium' }}</span>
                  </div>
                }
              </div>

              @if (selectedRun.errorSummary) {
                <div class="error-box">
                  <h5>Detalle del Error</h5>
                  <pre>{{ selectedRun.errorSummary }}</pre>
                </div>
              }

              @if (selectedRun.status === 'RUNNING' && !streamActive()) {
                <div class="stream-status">
                  <div class="spinner"></div>
                  <span>Escuchando eventos en tiempo real...</span>
                </div>
              }
            }
          </div>
        }
      </div>
    } @else {
      <div class="placeholder-panel">
        <p>Seleccione una ejecución de la tabla para ver su progreso en tiempo real.</p>
      </div>
    }
  `,
  styles: [`
    .stream-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      margin-bottom: 20px;
      overflow: hidden;
      color: var(--text-1);
    }
    .panel-header {
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .stream-panel.collapsed .panel-header {
      border-bottom: none;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-left h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .transfer-count {
      font-size: 0.8rem;
      color: var(--accent);
      font-weight: 600;
    }
    .pulse-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--text-3);
    }
    .pulse-indicator.active {
      background: var(--accent);
      box-shadow: 0 0 0 0 var(--accent-border);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 var(--accent-border);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(124, 111, 205, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(124, 111, 205, 0);
      }
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge[data-status="RUNNING"] {
      background: var(--accent-dim);
      color: var(--accent);
    }
    .status-badge[data-status="SUCCESS"] {
      background: var(--success-dim);
      color: var(--success);
    }
    .status-badge[data-status="FAILED"] {
      background: var(--danger-dim);
      color: var(--danger);
    }
    .collapse-btn {
      background: none;
      border: none;
      color: var(--text-2);
      font-size: 0.85rem;
      cursor: pointer;
    }
    .collapse-btn:hover {
      color: var(--text-1);
    }
    .panel-body {
      padding: 16px;
    }
    .stream-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--accent);
      margin-bottom: 12px;
      font-weight: 600;
    }
    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .product-table-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .product-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .product-table th {
      background: var(--surface-2);
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: var(--text-2);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
    }
    .product-table td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    .product-table tbody tr:last-child td {
      border-bottom: none;
    }
    .product-table tbody tr:hover {
      background: var(--surface-2);
    }
    .seq-col {
      width: 50px;
      color: var(--text-3);
    }
    .product-col {
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .price-col {
      width: 100px;
    }
    .source-col {
      width: 100px;
    }
    .status-col {
      width: 80px;
    }
    .product-status {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
    }
    .product-status[data-estado="OK"] {
      background: var(--success-dim);
      color: var(--success);
    }
    .product-status[data-estado="PENDING"] {
      background: var(--warning-dim, rgba(245, 158, 11, 0.1));
      color: var(--warning);
    }
    .product-status[data-estado="ERROR"] {
      background: var(--danger-dim);
      color: var(--danger);
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }
    .metric-card {
      background: var(--surface-2);
      padding: 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-2);
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 1.25rem;
      font-weight: 700;
    }
    .detail-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 0.875rem;
    }
    .detail-item {
      display: flex;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 1px dashed var(--border);
    }
    .detail-item .label {
      color: var(--text-2);
    }
    .detail-item .value {
      font-weight: 500;
    }
    .error-box {
      background: var(--danger-dim);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
      margin-bottom: 16px;
    }
    .error-box h5 {
      color: var(--danger);
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .error-box pre {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--danger);
    }
    .stream-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--text-2);
      padding: 8px;
      background: var(--surface-2);
      border-radius: var(--radius);
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .placeholder-panel {
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      text-align: center;
      color: var(--text-2);
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
  `]
})
export class EtlStreamPanelComponent {
  run = input<EtlRunDto | null>(null);
  streamActive = input<boolean>(false);
  products = input<StreamedProduct[]>([]);

  collapsed = signal<boolean>(false);

  readonly streamedProducts = computed<StreamedProduct[]>(() => {
    const inputProducts = this.products();
    if (inputProducts.length > 0) {
      return inputProducts;
    }
    return [];
  });

  toggleCollapse(): void {
    this.collapsed.update(c => !c);
  }
}