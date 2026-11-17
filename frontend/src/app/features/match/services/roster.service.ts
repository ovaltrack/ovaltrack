import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, throwError, from } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Match } from '../types/match.types';
import { MatchService } from './match.service';
import { AvailablePlayer, MatchRosterPlayer, RosterBootstrap, RosterBootstrapResponse, RosterPayload, SavedRoster } from '../types/roster.types';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';

@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly http = inject(HttpClient);
  private readonly matchesUrl = `${environment.apiUrl}/matches`;
  private readonly cache = inject(LocalDatabaseService);
  private readonly matchService = inject(MatchService);

  /** Partido, jugadores de la división y plantel en una sola petición; sin red lee lo guardado en Dexie. */
  getRosterBootstrap(matchId: string): Observable<RosterBootstrap> {
    return this.http.get<RosterBootstrapResponse>(`${this.matchesUrl}/${matchId}/roster-bootstrap`).pipe(
      map(response => ({
        match: this.matchService.normalizeMatch(response.match),
        players: response.players,
        roster: this.toSavedRoster(response.roster),
      })),
      switchMap(bootstrap => from(this.cacheBootstrap(bootstrap)).pipe(map(() => bootstrap))),
      catchError(error => from(this.readCachedBootstrap(matchId)).pipe(
        switchMap(cached => cached ? of(cached) : throwError(() => error))
      ))
    );
  }

  getAvailablePlayers(matchId: string): Observable<AvailablePlayer[]> {
    return this.http.get<Match>(`${this.matchesUrl}/${matchId}`).pipe(
      switchMap(match => {
        if (!match?.divisionId) {
          return throwError(() => new Error(`Partido ${matchId} no encontrado o sin división asignada`));
        }
        return this.getDivisionPlayers(match.divisionId);
      }),
      catchError(() => 
        from(this.cache.getMatch(matchId)).pipe(
          switchMap(match => {
            if (!match?.divisionId) return of([]);
            return from(this.cache.getPersonsByDivisionId(match.divisionId));
          })
        )
      ) 
    );
  }

  /** Trae los jugadores de la división y los deja en Dexie para el modo offline. */
  getDivisionPlayers(divisionId: string): Observable<AvailablePlayer[]> {
    return this.http.get<AvailablePlayer[]>(`${environment.apiUrl}/division/${divisionId}/players`).pipe(
      switchMap(players =>
        from(this.cache.savePersonsByDivisionId(players.map(p => ({ ...p, divisionId })))).pipe(map(() => players))
      )
    );
  }

  saveRoster(payload: RosterPayload): Observable<void> {
    return this.http.post<void>(`${this.matchesUrl}/${payload.matchId}/roster`, {
      titulares: payload.titulares,
      suplentes: payload.suplentes,
    });
  }

  getSavedRoster(matchId: string): Observable<SavedRoster | null> {
    return this.getMatchRosterPlayers(matchId).pipe(
      map(players => this.toSavedRoster(players)),
      switchMap(roster =>
        from(this.cache.saveRoster(matchId, roster)).pipe(
          map(() => roster)
        )
      ),
      catchError(error => {
        if (error.status === 404) {
          return of(null);
        }

        return from(this.cache.getRoster(matchId)).pipe(
          map(roster => roster ?? null)
        );
      })
    );
  }

  getMatchRosterPlayers(matchId: string): Observable<MatchRosterPlayer[]> {
    return this.http.get<MatchRosterPlayer[]>(
      `${this.matchesUrl}/${matchId}/roster/players`
    ).pipe(
      catchError(error => {
        if (error.status === 404) {
          return of([]);
        }
        return throwError(() => error);
      })
    );
  }

  getRosterOrDivisionPlayers(matchId: string): Observable<MatchRosterPlayer[]> {
    return this.getMatchRosterPlayers(matchId).pipe(
      switchMap(players => players.length > 0
        ? of(players)
        : this.getAvailablePlayers(matchId).pipe(
          map(available => available
            .filter(player => player.jerseyNumber != null)
            .map(player => ({
              id: player.id,
              fullName: player.fullName,
              position: player.position,
              number: player.jerseyNumber!,
              role: 'TITULAR' as const,
              fieldStatus: 'EN_CANCHA' as const,
              fieldSlot: null,
              slotOrder: null,
            })))
        ))
    );
  }

  private async cacheBootstrap({ match, players, roster }: RosterBootstrap): Promise<void> {
    // syncOfflineMatches borra el plantel de los partidos que no se usan sin conexión: va antes de guardarlo.
    await this.cache.syncOfflineMatches([match]);
    await Promise.all([
      this.cache.savePersonsByDivisionId(players.map(player => ({ ...player, divisionId: match.divisionId }))),
      this.cache.saveRoster(match.id, roster),
    ]);
  }

  private async readCachedBootstrap(matchId: string): Promise<RosterBootstrap | null> {
    const match = await this.cache.getMatch(matchId);
    if (!match) {
      return null;
    }
    const [players, roster] = await Promise.all([
      this.cache.getPersonsByDivisionId(match.divisionId),
      this.cache.getRoster(matchId),
    ]);
    return { match, players, roster: roster ?? { startingPlayers: [], substitutePlayers: [] } };
  }

  private toSavedRoster(players: MatchRosterPlayer[]): SavedRoster {
    return {
      startingPlayers: players
        .filter(player => player.role === 'TITULAR')
        .map(player => this.toRosterEntry(player)),
      substitutePlayers: players
        .filter(player => player.role === 'SUPLENTE')
        .map(player => this.toRosterEntry(player)),
    };
  }

  private toRosterEntry(player: MatchRosterPlayer) {
    return {
      playerId: player.id,
      number: player.number,
      role: player.role,
      fieldStatus: player.fieldStatus,
      fieldSlot: player.fieldSlot,
      slotOrder: player.slotOrder,
    };
  }
}