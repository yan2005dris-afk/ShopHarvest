import { Component, input, output, signal, HostListener } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="onCancel()">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
          <div class="modal-header">
            <h3>{{ title() }}</h3>
            <button class="close-btn" aria-label="Cerrar" (click)="onCancel()">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ message() }}</p>

            <div class="form-group">
              <label for="modal-action">Tipo de Ejecución</label>
              <select id="modal-action" [value]="action()" (change)="onActionChange($event)">
                <option value="full">Ejecutar Pipeline Completo (Scraping + ETL)</option>
                <option value="local">Procesar Capturas Pendientes únicamente (ETL Local)</option>
              </select>
            </div>

            <div class="form-group animate-fade-in">
              <label for="modal-source">
                {{ action() === 'full' ? 'Fuente a Scraping' : 'Fuente a Procesar' }}
              </label>
              <select id="modal-source" [value]="source()" (change)="onSourceChange($event)">
                <option value="all">Todas las fuentes</option>
                <option value="mercadolibre">MercadoLibre</option>
                <option value="aliexpress">AliExpress</option>
                <option value="temu">Temu</option>
                <option value="shein">SHEIN</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="onCancel()">{{ cancelText() }}</button>
            <button class="btn btn-primary" (click)="onConfirm()">{{ confirmText() }}</button>
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
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background: var(--surface);
      color: var(--text-1);
      border-radius: var(--radius-lg);
      width: 90%;
      max-width: 450px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--text-2);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }
    .close-btn:hover {
      color: var(--text-1);
    }
    .modal-body {
      padding: 20px 16px;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .form-group {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-2);
    }
    .form-group select {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 10px;
      color: var(--text-1);
      font-size: 0.9rem;
      width: 100%;
      outline: none;
    }
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: var(--radius);
      font-weight: 500;
      cursor: pointer;
      font-size: 0.875rem;
      border: none;
      transition: background-color 0.15s ease;
    }
    .btn-secondary {
      background: var(--surface-2);
      color: var(--text-2);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: var(--surface-3);
      color: var(--text-1);
    }
    .btn-primary {
      background: var(--accent);
      color: #ffffff;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
    }
  `]
})
export class ConfirmModalComponent {
  title = input<string>('Confirm Action');
  message = input<string>('Are you sure you want to proceed?');
  confirmText = input<string>('Confirm');
  cancelText = input<string>('Cancel');
  isOpen = input<boolean>(false);

  confirm = output<{ action: 'full' | 'local'; source: string }>();
  cancel = output<void>();

  // State signals inside modal
  action = signal<'full' | 'local'>('full');
  source = signal<string>('all');

  onConfirm(): void {
    this.confirm.emit({
      action: this.action(),
      source: this.source(),
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onActionChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'full' | 'local';
    this.action.set(val);
  }

  onSourceChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.source.set(val);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onCancel();
    }
  }
}
