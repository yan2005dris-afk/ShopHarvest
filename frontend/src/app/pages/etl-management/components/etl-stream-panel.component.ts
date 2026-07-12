import { Component, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

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
          <button class="collapse-btn">
            {{ collapsed() ? '▲ Mostrar' : '▼ Contraer' }}
          </button>
        </div>

        @if (!collapsed()) {
          <div class="panel-body">
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

            @if (selectedRun.status === 'RUNNING' && streamActive()) {
              <div class="stream-status">
                <div class="spinner"></div>
                <span>Escuchando eventos en tiempo real...</span>
              </div>
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
      background: var(--bg-card, #1e1e2d);
      border: 1px solid var(--border-color, #2d2d3f);
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
      color: var(--text-primary, #ffffff);
    }
    .panel-header {
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-color, #2d2d3f);
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
    .pulse-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #a1a5b7;
    }
    .pulse-indicator.active {
      background: #3699ff;
      box-shadow: 0 0 0 0 rgba(54, 153, 255, 0.7);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(54, 153, 255, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(54, 153, 255, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(54, 153, 255, 0);
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
    .collapse-btn {
      background: none;
      border: none;
      color: var(--text-secondary, #a1a5b7);
      font-size: 0.85rem;
      cursor: pointer;
    }
    .collapse-btn:hover {
      color: var(--text-primary, #ffffff);
    }
    .panel-body {
      padding: 16px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }
    .metric-card {
      background: var(--bg-body, #151521);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--border-color, #2d2d3f);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-secondary, #a1a5b7);
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
      border-bottom: 1px dashed var(--border-color, #2d2d3f);
    }
    .detail-item .label {
      color: var(--text-secondary, #a1a5b7);
    }
    .detail-item .value {
      font-weight: 500;
    }
    .error-box {
      background: rgba(246, 78, 96, 0.08);
      border: 1px solid rgba(246, 78, 96, 0.2);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .error-box h5 {
      color: #f64e60;
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .error-box pre {
      margin: 0;
      font-family: monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
      color: #f64e60;
    }
    .stream-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--text-secondary, #a1a5b7);
      padding: 8px;
      background: var(--bg-body, #151521);
      border-radius: 6px;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(54, 153, 255, 0.2);
      border-top-color: #3699ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .placeholder-panel {
      background: var(--bg-card, #1e1e2d);
      border: 1px dashed var(--border-color, #2d2d3f);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      color: var(--text-secondary, #a1a5b7);
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
  `]
})
export class EtlStreamPanelComponent {
  run = input<EtlRunDto | null>(null);
  streamActive = input<boolean>(false);

  collapsed = signal<boolean>(false);

  toggleCollapse(): void {
    this.collapsed.update(c => !c);
  }
}
