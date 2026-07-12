import { Component, input, output, HostListener } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="onCancel()">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
          <div class="modal-header">
            <h3>{{ title() }}</h3>
            <button class="close-btn" (click)="onCancel()" aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ message() }}</p>
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
      background: var(--bg-card, #1e1e2d);
      color: var(--text-primary, #ffffff);
      border-radius: 8px;
      width: 90%;
      max-width: 450px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border-color, #2d2d3f);
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color, #2d2d3f);
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
      color: var(--text-secondary, #a1a5b7);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }
    .close-btn:hover {
      color: var(--text-primary, #ffffff);
    }
    .modal-body {
      padding: 20px 16px;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color, #2d2d3f);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      font-size: 0.875rem;
      border: none;
      transition: background-color 0.15s ease;
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
    .btn-primary {
      background: #3699ff;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #187de4;
    }
  `]
})
export class ConfirmModalComponent {
  title = input<string>('Confirm Action');
  message = input<string>('Are you sure you want to proceed?');
  confirmText = input<string>('Confirm');
  cancelText = input<string>('Cancel');
  isOpen = input<boolean>(false);

  confirm = output<void>();
  cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onCancel();
    }
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
