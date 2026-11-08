import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { ConfirmRequest } from '../../types/ovaltrack-admin.types';

/**
 * Confirmación de una acción destructiva. Se monta solo mientras hay una pendiente.
 * El foco arranca en "Cancelar" (un Enter por error no ejecuta la acción); Esc y clic afuera cancelan.
 */
@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
  template: `
    <div class="adm-backdrop" (click)="cancelled.emit()">
      <div
        class="adm-card adm-dialog adm-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="adm-confirm-title"
        aria-describedby="adm-confirm-message"
        (click)="$event.stopPropagation()"
      >
        <div class="adm-card-header">
          <h2 id="adm-confirm-title">{{ request().title }}</h2>
        </div>
        <div class="adm-confirm-body" id="adm-confirm-message">
          <p class="adm-confirm-message">{{ request().message }}</p>
          @if (request().detail) {
            <p class="adm-confirm-detail">{{ request().detail }}</p>
          }
        </div>
        <div class="adm-dialog-footer">
          <button #cancelBtn type="button" class="btn btn-outline" (click)="cancelled.emit()">Cancelar</button>
          <button type="button" class="btn adm-btn-danger" (click)="confirmed.emit()">{{ request().confirmLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../../styles/admin-panel.css', './admin-confirm-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConfirmDialogComponent {
  readonly request = input.required<ConfirmRequest>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly cancelBtn = viewChild.required<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    afterNextRender(() => this.cancelBtn().nativeElement.focus());
  }
}
