import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-batch-action-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="batch-bar">
      <div class="batch-text">
        <span>{{ dirtyCount }}</span> cambios sin guardar
      </div>
      <div class="batch-actions">
        <button class="btn-ghost" type="button" (click)="discard.emit()" [disabled]="isSaving">Descartar</button>
        <button
          class="btn btn-save"
          type="button"
          (click)="save.emit()"
          [disabled]="isSaving"
        >
          {{ isSaving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .batch-bar {
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%);
      z-index: 30;
      width: calc(100% - 32px);
      max-width: 520px;
      background: var(--text-primary, #1c2416);
      color: #ffffff;
      border-radius: var(--radius-lg, 14px);
      padding: 10px 10px 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 16px 36px rgba(20, 25, 15, 0.28);
      animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translate(-50%, 15px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }

    .batch-text {
      font-size: 13.5px;
      font-weight: 600;
    }

    .batch-text span {
      color: var(--grass, #68bb2b);
      font-family: var(--font-mono, monospace);
    }

    .batch-actions {
      display: flex;
      gap: 8px;
    }

    .btn-ghost {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.75);
      font-size: 13.5px;
      font-weight: 600;
      padding: 0 12px;
      height: 40px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-ghost:hover:not(:disabled) {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-save {
      background: var(--accent, #e5b300);
      color: var(--text-primary, #1c2416);
      border: none;
      font-weight: 700;
      font-size: 13.5px;
      padding: 0 18px;
      height: 40px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: none;
      transition: all 0.15s ease;
    }

    .btn-save:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    .btn-save:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    :host-context([data-theme="dark"]) .batch-bar {
      background: var(--surface-alt);
      border: 1px solid var(--border-sport);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
    }

    :host-context([data-theme="dark"]) .btn-save {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-fg);
    }

    :host-context([data-theme="dark"]) .btn-save:hover:not(:disabled) {
      background: var(--btn-primary-hover);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BatchActionBarComponent {
  @Input({ required: true }) dirtyCount = 0;
  @Input() isSaving = false;
  @Output() discard = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
}
