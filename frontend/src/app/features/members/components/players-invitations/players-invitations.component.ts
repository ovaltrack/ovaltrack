import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { InvitationService } from '../../../invitation/service/invitation.service';
import { ClubPlayer } from '../../../invitation/types/invitation.types';
import {
  PLAYER_FILTERS,
  PLAYER_STATUS_META,
  PlayerFilter,
  matchesPlayerSearch,
  playerName,
  statusDetail,
} from './player-status';
import { oneOf, persistedSignal } from '../../../../shared/utils/persisted-signal';
import { AuthService } from '../../../auth/services/auth.service';
import { PersonResponse } from '../../../person/types/person.types';
import { canEditPersonData } from '../../types/members.types';
import { PersonEditDialogComponent } from '../person-edit-dialog/person-edit-dialog.component';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-players-invitations',
  standalone: true,
  imports: [PersonEditDialogComponent, RouterLink],
  templateUrl: './players-invitations.component.html',
  styleUrl: './players-invitations.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersInvitationsComponent {
  private readonly invitationService = inject(InvitationService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);

  readonly STATUS = PLAYER_STATUS_META;
  readonly FILTERS = PLAYER_FILTERS;
  readonly statusDetail = statusDetail;
  readonly playerName = playerName;

  readonly state = signal<LoadState>('loading');
  readonly players = signal<ClubPlayer[]>([]);
  readonly editingPersonId = signal<string | null>(null);
  readonly canEditPlayers = computed(() => canEditPersonData(this.authService.effectiveRole(), 'PLAYER'));
  readonly search = signal('');
  readonly filter = persistedSignal<PlayerFilter>('members.players.filter', 'ALL', {
    isValid: oneOf(this.FILTERS.map(f => f.key)),
  });
  readonly sending = signal<ReadonlySet<string>>(new Set());

  readonly counts = computed(() => {
    const players = this.players();
    return Object.fromEntries(
      this.FILTERS.map((f) => [f.key, players.filter((p) => f.matches(p.status)).length]),
    ) as Record<PlayerFilter, number>;
  });

  readonly visiblePlayers = computed(() => {
    const query = this.search().trim().toLowerCase();
    const filter = this.FILTERS.find((f) => f.key === this.filter()) ?? this.FILTERS[0];
    return this.players().filter((p) => filter.matches(p.status) && matchesPlayerSearch(p, query));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.invitationService
      .getPlayers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (players) => {
          this.players.set(players);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  isSending(player: ClubPlayer): boolean {
    return this.sending().has(player.personId);
  }

  invite(player: ClubPlayer): void {
    if (this.isSending(player) || !this.STATUS[player.status].action) return;
    const resend = player.status !== 'NOT_INVITED';
    this.setSending(player.personId, true);
    this.invitationService
      .invite({ personId: player.personId })
      .pipe(
        finalize(() => this.setSending(player.personId, false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.players.update((list) => list.map((p) => (p.personId === updated.personId ? updated : p)));
          this.toast.success(
            `Le enviamos el enlace a ${updated.contactEmail}. Vence en 72 horas.`,
            resend ? 'Invitación reenviada' : 'Invitación enviada',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(error.error?.message ?? 'Intentá de nuevo en unos minutos.', 'No se pudo enviar la invitación');
          if (error.status === 409) this.load();
        },
      });
  }

  onPersonSaved(person: PersonResponse): void {
    this.players.update(list => list.map(player => player.personId === person.id
      ? { ...player, firstName: person.firstName, lastName: person.lastName, contactEmail: person.contactEmail }
      : player));
    this.editingPersonId.set(null);
  }

  private setSending(personId: string, sending: boolean): void {
    this.sending.update((current) => {
      const next = new Set(current);
      if (sending) next.add(personId);
      else next.delete(personId);
      return next;
    });
  }
}
