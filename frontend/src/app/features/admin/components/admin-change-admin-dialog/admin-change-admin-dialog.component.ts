import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Club } from 'src/app/features/club/types/club.types';
import { AdminPanelStore } from '../../store/admin-panel.store';
import { userName } from '../../utils/admin-format';
import { AdminPersonComponent } from '../admin-person/admin-person.component';

/**
 * Cambiar el administrador de un club. Sin disparador en la UI hasta que exista
 * `PUT /clubs/{id}/admin` (Fase 4); hoy solo cambia el estado local.
 */
@Component({
  selector: 'app-admin-change-admin-dialog',
  standalone: true,
  imports: [AdminPersonComponent],
  host: { '(document:keydown.escape)': 'store.closeChangeAdmin()' },
  template: `
    <div class="adm-backdrop" (click)="store.closeChangeAdmin()">
      <div class="adm-card adm-dialog" role="dialog" aria-modal="true" aria-labelledby="change-admin-title" (click)="$event.stopPropagation()">
        <div class="adm-card-header">
          <div>
            <h2 id="change-admin-title">Cambiar administrador</h2>
            <p>{{ club().name }} · {{ club().city }}</p>
          </div>
        </div>
        <ul class="adm-admin-list" role="listbox" aria-label="Administradores disponibles">
          @for (a of store.admins(); track a.user.id) {
            <li>
              <button
                type="button"
                role="option"
                class="adm-option"
                [class.is-selected]="store.newAdminId() === a.user.id"
                [attr.aria-selected]="store.newAdminId() === a.user.id"
                (click)="store.newAdminId.set(a.user.id)"
              >
                <span appAdminPerson [userRole]="'ADMIN_CLUB'" [name]="userName(a.user)" [detail]="a.user.email" [monoDetail]="true"></span>
              </button>
            </li>
          }
        </ul>
        <div class="adm-dialog-footer">
          <button type="button" class="btn btn-outline" (click)="store.closeChangeAdmin()">Cancelar</button>
          <button
            type="button"
            class="btn btn-primary-rugby"
            [disabled]="store.newAdminId() === club().adminUserId"
            (click)="store.confirmChangeAdmin()"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../../styles/admin-panel.css', './admin-change-admin-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminChangeAdminDialogComponent {
  readonly store = inject(AdminPanelStore);
  readonly club = input.required<Club>();

  readonly userName = userName;
}
