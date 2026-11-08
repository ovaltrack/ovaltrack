import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Club } from 'src/app/features/club/types/club.types';
import { AdminPanelStore } from '../../store/admin-panel.store';
import { userName } from '../../utils/admin-format';
import { AdminPersonComponent } from '../admin-person/admin-person.component';
import { AdminTablePlaceholderComponent } from '../admin-table-placeholder/admin-table-placeholder.component';

/**
 * Cambiar el administrador de un club (`PUT /clubs/{id}/admin`). Solo se elige entre los
 * entrenadores/analistas activos del club; el admin anterior pasa a entrenador/analista.
 * Desde la baja de un admin de club ("Reasignar"), al guardar también se desactiva su cuenta.
 */
@Component({
  selector: 'app-admin-change-admin-dialog',
  standalone: true,
  imports: [AdminPersonComponent, AdminTablePlaceholderComponent],
  host: { '(document:keydown.escape)': 'store.closeChangeAdmin()' },
  template: `
    <div class="adm-backdrop" (click)="store.closeChangeAdmin()">
      <div class="adm-card adm-dialog" role="dialog" aria-modal="true" aria-labelledby="change-admin-title" (click)="$event.stopPropagation()">
        <div class="adm-card-header">
          <div>
            <h2 id="change-admin-title">{{ previous() ? 'Reasignar administrador' : 'Cambiar administrador' }}</h2>
            <p>{{ club().name }} · {{ club().city }}</p>
          </div>
        </div>
        <p class="adm-change-note">
          Elegí un entrenador/analista activo del club.
          @if (previous(); as prev) {
            Al guardar, la cuenta de <b>{{ userName(prev.user) }}</b> queda desactivada.
          } @else {
            El administrador actual pasa a entrenador/analista.
          }
        </p>
        @if (store.candidatesLoading()) {
          <app-admin-table-placeholder [loading]="true" />
        } @else {
          <ul class="adm-admin-list" role="listbox" aria-label="Entrenadores del club">
            @for (u of store.adminCandidates(); track u.id) {
              <li>
                <button
                  type="button"
                  role="option"
                  class="adm-option"
                  [class.is-selected]="store.newAdminId() === u.id"
                  [attr.aria-selected]="store.newAdminId() === u.id"
                  (click)="store.newAdminId.set(u.id)"
                >
                  <span appAdminPerson [userRole]="'COACH_ANALYST'" [name]="userName(u)" [detail]="u.email" [monoDetail]="true"></span>
                </button>
              </li>
            } @empty {
              <li>
                <app-admin-table-placeholder icon="bi-person-x" message="El club no tiene entrenadores/analistas activos para designar." />
              </li>
            }
          </ul>
        }
        <div class="adm-dialog-footer">
          <button type="button" class="btn btn-outline" (click)="store.closeChangeAdmin()">Cancelar</button>
          <button type="button" class="btn btn-primary-rugby" [disabled]="!store.newAdminId() || store.busy()" (click)="store.confirmChangeAdmin()">
            {{ previous() ? 'Reasignar y desactivar' : 'Guardar cambios' }}
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

  readonly previous = computed(() => this.store.deactivateAfterChange());
  readonly userName = userName;
}
