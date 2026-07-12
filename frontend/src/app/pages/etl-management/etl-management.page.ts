import { Component, inject, OnInit, signal } from '@angular/core';
import { EtlManagementStore } from './etl-management.store';
import { ConfirmModalComponent } from './components/confirm-modal.component';
import { EtlStreamPanelComponent } from './components/etl-stream-panel.component';
import { EtlRunsTableComponent } from './components/etl-runs-table.component';
import { KeyValuePipe } from '@angular/common';

@Component({
  selector: 'app-etl-management-page',
  standalone: true,
  imports: [
    ConfirmModalComponent,
    EtlStreamPanelComponent,
    EtlRunsTableComponent,
    KeyValuePipe,
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div class="header-title">
          <h2>Gestión de Pipeline ETL</h2>
          <p class="subtitle">Monitoreo y ejecución manual de procesos de extracción y carga</p>
        </div>
        <div class="header-actions">
          <button 
            class="btn-trigger" 
            [disabled]="store.streamActive() || store.loading()"
            (click)="onOpenTriggerModal()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Ejecutar ETL</span>
          </button>
        </div>
      </header>

      @if (store.error(); as err) {
        <div class="alert alert-danger">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <strong>Error:</strong> {{ err }}
          </div>
          <button class="alert-close" (click)="store.clearError()">&times;</button>
        </div>
      }

      <!-- Pending Queue Summary -->
      @if (store.pendingSummary(); as pending) {
        <div class="pending-summary">
          <div class="pending-header">
            <h3>Lotes de Ingesta Pendientes</h3>
            <span class="pending-badge" [class.badge-clean]="pending.total === 0">
              {{ pending.total }} items para procesar
            </span>
          </div>
          <div class="pending-grid">
            @for (item of pending.sources | keyvalue; track item.key) {
              <div class="pending-card">
                <div class="card-title-row">
                  <span class="source-name">{{ item.value.name }}</span>
                  <span class="source-code">{{ item.key }}</span>
                </div>
                <div class="card-stats">
                  <div class="stat-group">
                    <span class="stat-label">Nuevos</span>
                    <span class="stat-val pending-count">{{ item.value.pending }}</span>
                  </div>
                  <div class="stat-group">
                    <span class="stat-label">Fallidos</span>
                    <span class="stat-val failed-count" [class.has-failed]="item.value.failed > 0">{{ item.value.failed }}</span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <div class="page-content">
        <!-- Live SSE stream panel -->
        <app-etl-stream-panel 
          [run]="store.selectedRun()" 
          [streamActive]="store.streamActive()"
        />

        <!-- Paginated Runs Table -->
        <app-etl-runs-table 
          [runs]="store.runs()" 
          [meta]="store.meta()" 
          [selectedRunId]="store.selectedRun()?.id" 
          [loading]="store.loading()"
          (pageChange)="store.setPage($event)"
          (rowSelect)="store.selectRun($event)"
          (filterChange)="store.setFilters($event)"
        />
      </div>

      <!-- Trigger ETL confirm modal -->
      <app-confirm-modal 
        [isOpen]="isConfirmOpen()"
        title="Ejecutar Pipeline ETL"
        message="¿Estás seguro de iniciar una ejecución completa del pipeline ETL? Esto activará el Scraping de todas las fuentes configuradas, Staging y la carga de datos al Data Warehouse. Puede tardar varios minutos."
        confirmText="Iniciar Ejecución"
        cancelText="Cancelar"
        (confirm)="onConfirmTrigger()"
        (cancel)="onCancelTrigger()"
      />
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title h2 {
      margin: 0 0 4px 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-1);
    }
    .header-title .subtitle {
      margin: 0;
      font-size: 0.875rem;
      color: var(--text-2);
    }
    .pending-summary {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .pending-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pending-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-1);
    }
    .pending-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: var(--warning-dim, rgba(245, 158, 11, 0.1));
      color: var(--warning);
      padding: 4px 10px;
      border-radius: 999px;
    }
    .pending-badge.badge-clean {
      background: var(--success-dim);
      color: var(--success);
    }
    .pending-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .pending-card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .source-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-1);
    }
    .source-code {
      font-size: 0.75rem;
      color: var(--text-3);
      text-transform: uppercase;
      font-weight: 700;
    }
    .card-stats {
      display: flex;
      gap: 24px;
    }
    .stat-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-label {
      font-size: 0.75rem;
      color: var(--text-2);
      font-weight: 500;
    }
    .stat-val {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-1);
    }
    .failed-count.has-failed {
      color: var(--danger);
    }
    .btn-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #1abc9c;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background-color 0.15s ease, opacity 0.15s ease;
    }
    .btn-trigger:hover:not(:disabled) {
      background: #16a085;
    }
    .btn-trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .alert {
      padding: 12px 16px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.9rem;
      position: relative;
    }
    .alert-danger {
      background: rgba(246, 78, 96, 0.1);
      border: 1px solid rgba(246, 78, 96, 0.2);
      color: #f64e60;
    }
    .alert-close {
      background: none;
      border: none;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
    }
    .page-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
  `]
})
export class EtlManagementPage implements OnInit {
  readonly store = inject(EtlManagementStore);

  isConfirmOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.store.loadRuns();
  }

  onOpenTriggerModal(): void {
    this.isConfirmOpen.set(true);
  }

  onConfirmTrigger(): void {
    this.isConfirmOpen.set(false);
    this.store.triggerRun();
  }

  onCancelTrigger(): void {
    this.isConfirmOpen.set(false);
  }
}
export default EtlManagementPage;
