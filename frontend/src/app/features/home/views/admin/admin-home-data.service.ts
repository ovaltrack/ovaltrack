import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DivisionCoachService } from '../../../../services/division-coach.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { Division } from '../../../division/types/division.types';
import { EventService } from '../../../match/services/event.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { Match } from '../../../match/types/match.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { ToWidgetStateOptions, toWidgetState } from '../../data/to-widget-state';
import { analysisCoverage } from '../../domain/analysis-coverage';
import { lastFinishedOf } from '../../domain/division-match-state';
import { WidgetState } from '../../types/home.types';

/** Lo que el administrador ve de cada división; `null` = no se pudo leer. */
export interface DivisionStat {
  divisionId: string;
  /** Entrenadores activos. */
  staff: number | null;
  players: number | null;
  /** % de análisis del último partido jugado. */
  analysisPercent: number | null;
}

export type RosterCounts = Record<string, { starters: number; substitutes: number }>;

/** Lecturas del Inicio del administrador del club; cada widget devuelve su `WidgetState` con snapshot offline. */
@Injectable()
export class AdminHomeDataService {
  private readonly matchService = inject(MatchService);
  private readonly rosterService = inject(RosterService);
  private readonly eventService = inject(EventService);
  private readonly coachService = inject(DivisionCoachService);
  private readonly playerService = inject(DivisionPlayerService);
  private readonly cache = inject(DashboardSnapshotCache);
  private readonly userContext = inject(UserContextService);
  private readonly connectivity = inject(ConnectivityService);

  matches(clubId: string): Observable<WidgetState<Match[]>> {
    return this.matchService.getMatchesByClub(clubId).pipe(toWidgetState<Match[]>(this.options('matches', { isEmpty: () => false })));
  }

  /** Nómina de cada partido pendiente; un partido que falla queda sin dato (se lee como "sin nómina"). */
  rosters(matches: readonly Match[]): Observable<RosterCounts> {
    if (matches.length === 0) return of({});
    return forkJoin(matches.map(match => this.rosterService.getSavedRoster(match.id).pipe(
      map(roster => [match.id, roster ? { starters: roster.startingPlayers.length, substitutes: roster.substitutePlayers.length } : null] as const),
      catchError(() => of([match.id, null] as const))
    ))).pipe(
      map(pairs => Object.fromEntries(pairs.filter((pair): pair is readonly [string, { starters: number; substitutes: number }] => pair[1] !== null)))
    );
  }

  divisionStats(divisions: readonly Division[], matches: readonly Match[]): Observable<WidgetState<DivisionStat[]>> {
    const loads = divisions.map(division => forkJoin({
      staff: this.coachService.getByDivisionId(division.id).pipe(
        map(coaches => coaches.filter(coach => !coach.endDate).length), catchError(() => of(null))),
      players: this.playerService.getActiveByDivisionId(division.id, 1, 1).pipe(
        map(page => page.totalElements), catchError(() => of(null))),
      analysisPercent: this.lastFinishedAnalysis(division.id, matches)
    }).pipe(map(values => ({ divisionId: division.id, ...values }))));
    return (loads.length > 0 ? forkJoin(loads) : of([] as DivisionStat[])).pipe(toWidgetState<DivisionStat[]>(this.options('divisions')));
  }

  private lastFinishedAnalysis(divisionId: string, matches: readonly Match[]): Observable<number | null> {
    const last = lastFinishedOf(matches.filter(match => match.divisionId === divisionId));
    if (!last) return of(null);
    return this.eventService.getByMatchPostMatch(last.id).pipe(map(events => analysisCoverage(events).percent), catchError(() => of(null)));
  }

  private options<T>(widget: string, extra: Partial<ToWidgetStateOptions<T>> = {}): ToWidgetStateOptions<T> {
    const userId = this.userContext.userContext()?.userId;
    return {
      ...extra,
      offline: !this.connectivity.online(),
      snapshot: userId
        ? {
            read: () => this.cache.read<T>(userId, `admin.${widget}`),
            write: (data, fetchedAt) => this.cache.write(userId, `admin.${widget}`, data, fetchedAt)
          }
        : undefined
    };
  }
}
