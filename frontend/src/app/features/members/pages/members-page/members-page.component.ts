import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { PlayersInvitationsComponent } from '../../components/players-invitations/players-invitations.component';
import { MembersListComponent } from '../members-list/members-list.component';

type MembersTab = 'cuentas' | 'jugadores';

/**
 * Miembros: el admin del club ve las cuentas (roles, altas y bajas) y los jugadores para invitar;
 * el entrenador, solo los jugadores de sus divisiones. La pestaña vive en `?tab=` para poder enlazarla.
 */
@Component({
  selector: 'app-members-page',
  standalone: true,
  imports: [MembersListComponent, PlayersInvitationsComponent],
  templateUrl: './members-page.component.html',
  styleUrl: './members-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly canManageAccounts = computed(() => {
    const role = this.authService.effectiveRole();
    return role === 'ADMIN_CLUB' || role === 'ADMIN_OVALTRACK';
  });

  private readonly requestedTab = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tab'))),
    { initialValue: this.route.snapshot.queryParamMap.get('tab') },
  );

  readonly tab = computed<MembersTab>(() =>
    !this.canManageAccounts() || this.requestedTab() === 'jugadores' ? 'jugadores' : 'cuentas',
  );

  select(tab: MembersTab): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
  }
}
