import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, output, viewChild } from '@angular/core';
import { ConfirmChoice, ConfirmRequest } from '../../types/ovaltrack-admin.types';

const TONE_CLASS: Record<ConfirmChoice['tone'], string> = {
  primary: 'btn-primary-rugby',
  danger: 'adm-btn-danger',
  outline: 'btn-outline',
};

/**
 * Confirmación de una acción destructiva, o con varias salidas (`kind: 'choices'`).
 * Se monta solo mientras hay una pendiente.
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
        @if (choices(); as options) {
          <div class="adm-dialog-footer adm-choices">
            @for (c of options; track c.label) {
              <button type="button" class="btn" [class]="toneClass[c.tone]" (click)="chosen.emit(c)">
                <i class="bi" [class]="c.icon" aria-hidden="true"></i> {{ c.label }}
              </button>
            }
            <button #cancelBtn type="button" class="btn btn-outline" (click)="cancelled.emit()">Cancelar</button>
          </div>
        } @else {
          <div class="adm-dialog-footer">
            <button #cancelBtn type="button" class="btn btn-outline" (click)="cancelled.emit()">Cancelar</button>
            <button type="button" class="btn adm-btn-danger" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['../../styles/admin-panel.css', './admin-confirm-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConfirmDialogComponent {
  readonly request = input.required<ConfirmRequest>();
  readonly confirmed = output<void>();
  readonly chosen = output<ConfirmChoice>();
  readonly cancelled = output<void>();

  readonly choices = computed(() => {
    const request = this.request();
    return request.kind === 'choices' ? request.choices : null;
  });
  readonly confirmLabel = computed(() => {
    const request = this.request();
    return request.kind === 'choices' ? '' : request.confirmLabel;
  });
  readonly toneClass = TONE_CLASS;

  private readonly cancelBtn = viewChild.required<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    afterNextRender(() => this.cancelBtn().nativeElement.focus());
  }
}
