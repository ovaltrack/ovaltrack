import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member, getMemberDisplayName } from '../../types/members.types';

@Component({
  selector: 'app-deactivate-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="modalTitle">
        <div class="modal-header">
          <h3 id="modalTitle" class="modal-title">¿Dar de baja a este usuario?</h3>
          <button class="close-btn" (click)="cancel.emit()" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">
          <p>
            Estás por revocar el acceso a la plataforma para
            <strong>{{ displayName }}</strong> ({{ member.email }}).
          </p>
          <p class="modal-note">
            Su historial de estadísticas, eventos de partido y datos de persona permanecerán intactos en la base de datos, pero el usuario no podrá volver a iniciar sesión.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" (click)="cancel.emit()" [disabled]="isProcessing">Cancelar</button>
          <button class="btn btn-danger" type="button" (click)="confirm.emit()" [disabled]="isProcessing">
            {{ isProcessing ? 'Procesando...' : 'Confirmar baja' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-card {
      background: #ffffff;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      border: 1px solid var(--border, #e2e8f0);
      animation: scaleUp 0.2s ease-out;
    }

    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .modal-header {
      padding: 20px 24px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border, #e2e8f0);
    }

    .modal-title {
      font-family: var(--font-head, sans-serif);
      font-size: 18px;
      font-weight: 700;
      color: #991b1b;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 18px;
      color: var(--text-muted, #64748b);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: #f1f5f9;
      color: var(--text-primary, #0f172a);
    }

    .modal-body {
      padding: 20px 24px;
      font-size: 14.5px;
      color: var(--text-primary, #0f172a);
      line-height: 1.5;
    }

    .modal-note {
      margin-top: 12px;
      padding: 12px;
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 4px;
      font-size: 13px;
      color: #991b1b;
    }

    .modal-footer {
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid var(--border, #e2e8f0);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border, #cbd5e1);
      color: var(--text-muted, #475569);
      font-size: 13.5px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-ghost:hover:not(:disabled) {
      background: #f1f5f9;
      color: var(--text-primary, #0f172a);
    }

    .btn-danger {
      background-color: #dc2626;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .btn-danger:hover:not(:disabled) {
      background-color: #b91c1c;
    }

    .btn-danger:disabled,
    .btn-ghost:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

    :host-context([data-theme="dark"]) .modal-title {
      color: var(--error);
    }

    :host-context([data-theme="dark"]) .close-btn:hover {
      background: var(--surface-hover);
    }

    :host-context([data-theme="dark"]) .modal-note {
      background: var(--error-tint);
      border-left-color: var(--error);
      color: var(--error);
    }

    :host-context([data-theme="dark"]) .modal-footer {
      background: var(--surface-alt);
    }

    :host-context([data-theme="dark"]) .btn-ghost {
      border-color: var(--border-strong);
    }

    :host-context([data-theme="dark"]) .btn-ghost:hover:not(:disabled) {
      background: var(--surface-hover);
    }

    :host-context([data-theme="dark"]) .btn-danger {
      background-color: var(--error-solid);
    }

    :host-context([data-theme="dark"]) .btn-danger:hover:not(:disabled) {
      background-color: var(--error);
      color: var(--bg);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeactivateModalComponent {
  @Input({ required: true }) member!: Member;
  @Input() isProcessing = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  get displayName(): string {
    return getMemberDisplayName(this.member);
  }
}
