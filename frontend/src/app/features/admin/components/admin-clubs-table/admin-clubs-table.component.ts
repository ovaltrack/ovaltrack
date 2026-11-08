import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminPanelStore, CLUB_FILTER_OPTIONS } from '../../store/admin-panel.store';
import { userName } from '../../utils/admin-format';
import { AdminPersonComponent } from '../admin-person/admin-person.component';
import { AdminTablePlaceholderComponent } from '../admin-table-placeholder/admin-table-placeholder.component';
import { AdminTableToolbarComponent } from '../admin-table-toolbar/admin-table-toolbar.component';

/** Clubes ya revisados con su administrador: cambiar admin, desactivar (con confirmación) o reactivar. */
@Component({
  selector: 'app-admin-clubs-table',
  standalone: true,
  imports: [AdminPersonComponent, AdminTablePlaceholderComponent, AdminTableToolbarComponent],
  templateUrl: './admin-clubs-table.component.html',
  styleUrls: ['../../styles/admin-panel.css', './admin-clubs-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminClubsTableComponent {
  readonly store = inject(AdminPanelStore);

  readonly filterOptions = CLUB_FILTER_OPTIONS;
  readonly userName = userName;
}
