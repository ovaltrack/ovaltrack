import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title">{{ title }}</h3>
          <button class="close-btn" type="button" (click)="cancel.emit()" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
          <p class="modal-description" *ngIf="description">{{ description }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" (click)="cancel.emit()" [disabled]="isProcessing">Cancelar</button>
          <button class="btn-confirm" type="button" (click)="confirm.emit()" [disabled]="isProcessing">
            {{ isProcessing ? 'Procesando...' : 'Aceptar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
    }

    .modal-card {
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    .modal-header,
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
    }

    .modal-header {
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-title {
      margin: 0;
      color: #991b1b;
      font-size: 18px;
      font-weight: 700;
    }

    .close-btn {
      padding: 4px 8px;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: #64748b;
      font-size: 22px;
      cursor: pointer;
    }

    .close-btn:hover,
    .close-btn:focus-visible {
      background: #f1f5f9;
      color: #0f172a;
    }

    .modal-body {
      padding: 20px 24px;
      color: #0f172a;
      line-height: 1.5;
    }

    .modal-body p {
      margin: 0;
    }

    .modal-description {
      margin-top: 12px !important;
      color: #64748b;
      font-size: 13px;
    }

    .modal-footer {
      justify-content: flex-end;
      gap: 12px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .btn-ghost,
    .btn-confirm {
      padding: 9px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-ghost {
      border: 1px solid #cbd5e1;
      background: transparent;
      color: #475569;
    }

    .btn-confirm {
      border: 0;
      background: #dc2626;
      color: #ffffff;
    }

    .btn-ghost:disabled,
    .btn-confirm:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* Modo oscuro: tarjeta sobre la superficie elevada */
    :host-context([data-theme="dark"]) .modal-backdrop {
      background: var(--scrim);
    }

    :host-context([data-theme="dark"]) .modal-card {
      background: var(--surface-overlay);
      border-color: var(--border-strong);
      box-shadow: var(--shadow-overlay);
    }

    :host-context([data-theme="dark"]) .modal-header {
      border-bottom-color: var(--border);
    }

    :host-context([data-theme="dark"]) .modal-footer {
      background: var(--surface-alt);
      border-top-color: var(--border);
    }

    :host-context([data-theme="dark"]) .modal-title {
      color: var(--error);
    }

    :host-context([data-theme="dark"]) .close-btn {
      color: var(--text-muted);
    }

    :host-context([data-theme="dark"]) .close-btn:hover,
    :host-context([data-theme="dark"]) .close-btn:focus-visible {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    :host-context([data-theme="dark"]) .modal-body {
      color: var(--text-primary);
    }

    :host-context([data-theme="dark"]) .modal-description {
      color: var(--text-muted);
    }

    :host-context([data-theme="dark"]) .btn-ghost {
      border-color: var(--border-strong);
      color: var(--text-secondary);
    }

    :host-context([data-theme="dark"]) .btn-confirm {
      background: var(--error-solid);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() description = '';
  @Input() isProcessing = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
