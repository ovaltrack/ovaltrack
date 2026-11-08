import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, filter, forkJoin, map, of, shareReplay, switchMap, take, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PlayerMatchDTO, PlayerMatchSource, PlayerMatchStatistic } from '../types/player-statistics.types';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { EventTypeService } from '../../match/services/event-type.service';
import { EventService } from '../../match/services/event.service';
import { StatisticCalculationService } from '../../match/statistics/services/statistic-calculation.service';
import { RosterPlayerInfo } from '../../match/statistics/calculators';

/** Si el contexto no llega en este tiempo, la carga termina con error en lugar de quedar colgada. */
const USER_CONTEXT_TIMEOUT_MS = 10000;

@Injectable({ providedIn: 'root' })
export class PlayerStatisticsService {
  private readonly http = inject(HttpClient);
  private readonly userContext = inject(UserContextService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly eventService = inject(EventService);
  private readonly statisticService = inject(StatisticCalculationService);
  private readonly apiUrl = `${environment.apiUrl}/matches`;

  /** Catálogo de tipos activos: se pide una sola vez y lo comparten todos los partidos. */
  private readonly eventTypes$ = this.eventTypeService.getAll().pipe(shareReplay(1));

  /** El contexto de usuario se carga aparte: al recargar la página puede llegar después que los partidos. */
  private readonly personId$ = toObservable(this.userContext.personId).pipe(
    filter(personId => personId !== null),
    take(1),
    timeout(USER_CONTEXT_TIMEOUT_MS)
  );

  /** Partidos finalizados en los que jugó el usuario autenticado, del más reciente al más antiguo. */
  getMyMatches(): Observable<PlayerMatchDTO[]> {
    return this.http.get<PlayerMatchDTO[]>(`${this.apiUrl}/me`);
  }

  /** Estadísticas de todos los partidos jugados, en el mismo orden que `getMyMatches`. */
  loadAllMatchStatistics(): Observable<PlayerMatchStatistic[]> {
    return this.getMyMatches().pipe(
      switchMap(matches => matches.length === 0
        ? of([])
        : forkJoin(matches.map(match => this.loadMatchStatistic(match))))
    );
  }

  /** Un partido jugado por el usuario autenticado; `null` si no estuvo en ese plantel. */
  getMyMatch(matchId: string): Observable<PlayerMatchDTO | null> {
    return this.getMyMatches().pipe(
      map(matches => matches.find(match => match.matchId === matchId) ?? null)
    );
  }

  /** Eventos y catálogo de un partido: se cargan una vez y el cálculo por período se hace en memoria. */
  loadMatchSource(matchId: string): Observable<PlayerMatchSource> {
    return this.personId$.pipe(
      switchMap(() => forkJoin({
        // Solo backend: las estadísticas del jugador no funcionan sin conexión ni se guardan en IndexedDB.
        events: this.eventService.getByMatch(matchId),
        eventTypes: this.eventTypes$,
      }))
    );
  }

  /**
   * Estadísticas del usuario autenticado en un partido, con los mismos calculadores del post-partido
   * (vista `full`). Sin período: partido completo.
   */
  loadMatchStatistic(match: PlayerMatchDTO, period?: number): Observable<PlayerMatchStatistic> {
    return this.loadMatchSource(match.matchId).pipe(
      map(source => {
        const statistic = this.computeMatchStatistic(match, source, period);
        if (!statistic) {
          throw new Error('El usuario autenticado no tiene una persona asociada');
        }
        return statistic;
      })
    );
  }

  /**
   * Calcula las estadísticas del usuario autenticado sobre datos ya cargados, sin consultas.
   * Devuelve `null` sin persona en el contexto, por ejemplo al cerrar sesión con la pantalla abierta.
   */
  computeMatchStatistic(match: PlayerMatchDTO, source: PlayerMatchSource, period?: number): PlayerMatchStatistic | null {
    const personId = this.userContext.personId();
    if (!personId) {
      return null;
    }

    const me: RosterPlayerInfo = {
      playerId: personId,
      jerseyNumber: match.slotNumber ?? 0,
      playerName: this.userContext.fullName(),
      isStarter: match.role === 'TITULAR',
    };

    const { columns, players } = this.statisticService.computePlayerStatistics(
      source.events, [me], source.eventTypes, 'full', period
    );
    return { match, columns, stat: players[0] };
  }
}
