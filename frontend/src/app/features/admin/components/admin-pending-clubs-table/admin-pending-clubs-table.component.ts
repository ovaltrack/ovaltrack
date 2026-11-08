import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminPanelStore } from '../../store/admin-panel.store';
import { userName } from '../../utils/admin-format';
import { AdminPersonComponent } from '../admin-person/admin-person.component';
import { AdminTablePlaceholderComponent } from '../admin-table-placeholder/admin-table-placeholder.component';

/** Clubes pendientes: elegir administrador y aprobar, o rechazar (con confirmación). */
@Component({
  selector: 'app-admin-pending-clubs-table',
  standalone: true,
  imports: [AdminPersonComponent, AdminTablePlaceholderComponent],
  templateUrl: './admin-pending-clubs-table.component.html',
  styleUrls: ['../../styles/admin-panel.css', './admin-pending-clubs-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPendingClubsTableComponent {
  readonly store = inject(AdminPanelStore);

  readonly userName = userName;

  onAdminChange(clubId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.chooseAdminForPending(clubId, value || null);
  }
}
