import { Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

@Component({
  selector: 'app-etl-load-preview',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (run(); as r) {
      <div class="preview-panel">
        <div class="panel-header">
          <div class="header-left">
            @if (r.status === 'RUNNING') {
              <span class="pulse-dot"></span>
            } @else if (r.status === 'SUCCESS') {
              <span class="check-icon">✓</span>
            } @else if (r.status === 'FAILED') {
              <span class="error-icon">✗</span>
            }
            <span class="panel-title">Carga de datos · {{ r.source }}</span>
          </div>
          <span class="status-badge" [attr.data-status]="r.status">{{ r.status }}</span>
        </div>

        <div class="panel-body">
          @if (r.status === 'RUNNING') {
            <div class="running-indicator">
              <div class="spinner-sm"></div>
              <span>Procesando...</span>
            </div>
          }

          <div class="metric-row">
            <div class="metric-card metric-extracted">
              <span class="metric-num">{{ r.rowsScraped | number }}</span>
              <span class="metric-label">Extraídas</span>
            </div>
            <div class="metric-card metric-loaded">
              <span class="metric-num">{{ r.rowsPersisted | number }}</span>
              <span class="metric-label">Cargadas</span>
            </div>
            <div class="metric-card metric-failed">
              <span class="metric-num">{{ failedCount() | number }}</span>
              <span class="metric-label">Fallidas</span>
            </div>
          </div>

          @if (r.status === 'SUCCESS') {
            <p class="success-msg">
              ✓ {{ r.rowsPersisted | number }} filas cargadas al data warehouse
            </p>
          }

          @if (r.errorSummary && r.status === 'FAILED') {
            <div class="error-box">
              <strong>Error:</strong> {{ r.errorSummary }}
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="preview-placeholder">
        <span>Seleccioná una ejecución para ver el detalle de carga</span>
      </div>
    }
  `,
  styles: [`
    .preview-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .panel-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-2);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-1);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }
    .check-icon { color: var(--success); font-weight: 700; }
    .error-icon { color: var(--danger); font-weight: 700; }
    .status-badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-badge[data-status="RUNNING"] { background: var(--accent-dim); color: var(--accent); }
    .status-badge[data-status="SUCCESS"] { background: var(--success-dim); color: var(--success); }
    .status-badge[data-status="FAILED"] { background: var(--danger-dim); color: var(--danger); }
    .panel-body { padding: 16px; }
    .running-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--accent);
      margin-bottom: 12px;
      font-weight: 500;
    }
    .spinner-sm {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .metric-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }
    .metric-card {
      padding: 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .metric-extracted { background: rgba(59, 130, 246, 0.08); }
    .metric-loaded { background: rgba(16, 185, 129, 0.08); }
    .metric-failed { background: rgba(239, 68, 68, 0.08); }
    .metric-num {
      font-size: 1.4rem;
      font-weight: 800;
    }
    .metric-extracted .metric-num { color: #3b82f6; }
    .metric-loaded .metric-num { color: #10b981; }
    .metric-failed .metric-num { color: #ef4444; }
    .metric-label {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-2);
    }
    .success-msg {
      font-size: 0.85rem;
      color: var(--success);
      margin: 0;
      font-weight: 500;
    }
    .error-box {
      background: var(--danger-dim);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: var(--radius);
      padding: 10px 12px;
      font-size: 0.85rem;
      color: var(--danger);
    }
    .preview-placeholder {
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      text-align: center;
      color: var(--text-2);
      font-size: 0.875rem;
    }
  `]
})
export class EtlLoadPreviewComponent {
  run = input<EtlRunDto | null>(null);

  failedCount = computed(() => {
    const r = this.run();
    if (!r) return 0;
    return Math.max(0, r.rowsScraped - r.rowsPersisted);
  });
}
