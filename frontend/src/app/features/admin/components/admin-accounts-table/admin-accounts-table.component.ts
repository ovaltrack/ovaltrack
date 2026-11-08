import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ACCOUNT_FILTER_OPTIONS, AdminPanelStore } from '../../store/admin-panel.store';
import { roleClass, roleLabel, userName } from '../../utils/admin-format';
import { AdminPersonComponent } from '../admin-person/admin-person.component';
import { AdminTablePlaceholderComponent } from '../admin-table-placeholder/admin-table-placeholder.component';
import { AdminTableToolbarComponent } from '../admin-table-toolbar/admin-table-toolbar.component';

/** Todas las cuentas: filtro por estado, búsqueda, activar o desactivar (con confirmación). */
@Component({
  selector: 'app-admin-accounts-table',
  standalone: true,
  imports: [AdminPersonComponent, AdminTablePlaceholderComponent, AdminTableToolbarComponent],
  templateUrl: './admin-accounts-table.component.html',
  styleUrls: ['../../styles/admin-panel.css', './admin-accounts-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAccountsTableComponent {
  readonly store = inject(AdminPanelStore);

  readonly filterOptions = ACCOUNT_FILTER_OPTIONS;
  readonly userName = userName;
  readonly roleClass = roleClass;
  readonly roleLabel = roleLabel;
}
