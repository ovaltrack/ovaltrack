import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AdminAccountsTableComponent } from '../../components/admin-accounts-table/admin-accounts-table.component';
import { AdminChangeAdminDialogComponent } from '../../components/admin-change-admin-dialog/admin-change-admin-dialog.component';
import { AdminClubsTableComponent } from '../../components/admin-clubs-table/admin-clubs-table.component';
import { AdminConfirmDialogComponent } from '../../components/admin-confirm-dialog/admin-confirm-dialog.component';
import { AdminKpisComponent } from '../../components/admin-kpis/admin-kpis.component';
import { AdminPendingClubsTableComponent } from '../../components/admin-pending-clubs-table/admin-pending-clubs-table.component';
import { AdminRequestsTableComponent } from '../../components/admin-requests-table/admin-requests-table.component';
import { AdminPanelStore } from '../../store/admin-panel.store';

/** Panel de la plataforma (`ADMIN_OVALTRACK`): compone las secciones y comparte el store con ellas. */
@Component({
  selector: 'app-ovaltrack-admin',
  standalone: true,
  imports: [
    AdminKpisComponent,
    AdminRequestsTableComponent,
    AdminPendingClubsTableComponent,
    AdminAccountsTableComponent,
    AdminClubsTableComponent,
    AdminConfirmDialogComponent,
    AdminChangeAdminDialogComponent,
  ],
  providers: [AdminPanelStore],
  templateUrl: './ovaltrack-admin.component.html',
  styleUrl: './ovaltrack-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OvaltrackAdminComponent implements OnInit {
  readonly store = inject(AdminPanelStore);

  ngOnInit(): void {
    this.store.loadAll();
  }
}
