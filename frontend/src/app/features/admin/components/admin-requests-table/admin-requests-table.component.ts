import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminPanelStore } from '../../store/admin-panel.store';
import { formatDate, roleClass, roleLabel, userName } from '../../utils/admin-format';
import { AdminPersonComponent } from '../admin-person/admin-person.component';
import { AdminTablePlaceholderComponent } from '../admin-table-placeholder/admin-table-placeholder.component';

/** Solicitudes de registro pendientes: aprobar o rechazar (con confirmación). */
@Component({
  selector: 'app-admin-requests-table',
  standalone: true,
  imports: [AdminPersonComponent, AdminTablePlaceholderComponent],
  templateUrl: './admin-requests-table.component.html',
  styleUrls: ['../../styles/admin-panel.css', './admin-requests-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRequestsTableComponent {
  readonly store = inject(AdminPanelStore);

  readonly userName = userName;
  readonly roleClass = roleClass;
  readonly roleLabel = roleLabel;
  readonly formatDate = formatDate;
}
