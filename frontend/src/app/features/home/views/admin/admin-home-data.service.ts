import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DivisionCoachService } from '../../../../services/division-coach.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { Division } from '../../../division/types/division.types';
import { EventService } from '../../../match/services/event.service';
import { EventTypeService } from '../../../match/services/event-type.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { Match } from '../../../match/types/match.types';
import { loadActiveTypeIds } from '../../data/active-type-ids';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { ToWidgetStateOptions, toWidgetState } from '../../data/to-widget-state';
import { analysisCoverage } from '../../domain/analysis-coverage';
import { DivisionStat } from '../../domain/division-status';
import { lastFinishedOf, upcomingMatches } from '../../domain/division-match-state';
import { WidgetState } from '../../types/home.types';

export type { DivisionStat };

export type RosterCounts = Record<string, { starters: number; substitutes: number }>;

/** Lecturas del Inicio del administrador del club; cada widget devuelve su `WidgetState` con snapshot offline. */
@Injectable()
export class AdminHomeDataService {
  private readonly matchService = inject(MatchService);
  private readonly rosterService = inject(RosterService);
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);
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

  divisionStats(divisions: readonly Division[], matches: readonly Match[], now: Date): Observable<WidgetState<DivisionStat[]>> {
    const activeTypeIds$ = loadActiveTypeIds(this.eventTypeService).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    const loads = divisions.map(division => forkJoin({
      staff: this.coachService.getByDivisionId(division.id).pipe(
        map(coaches => coaches.filter(coach => !coach.endDate).length), catchError(() => of(null))),
      players: this.playerService.getActiveByDivisionId(division.id, 1, 1).pipe(
        map(page => page.totalElements), catchError(() => of(null))),
      analysisPercent: this.lastFinishedAnalysis(division.id, matches, activeTypeIds$),
      roster: this.nextRoster(division.id, matches, now)
    }).pipe(map(values => ({ divisionId: division.id, ...values }))));
    return (loads.length > 0 ? forkJoin(loads) : of([] as DivisionStat[])).pipe(toWidgetState<DivisionStat[]>(this.options('divisions')));
  }

  /** Nómina del próximo partido de la división; `null` si no hay próximo partido o no se pudo leer. */
  private nextRoster(divisionId: string, matches: readonly Match[], now: Date): Observable<{ starters: number; substitutes: number } | null> {
    const next = upcomingMatches(matches.filter(match => match.divisionId === divisionId), now)[0];
    if (!next) return of(null);
    return this.rosterService.getSavedRoster(next.id).pipe(
      map(roster => roster ? { starters: roster.startingPlayers.length, substitutes: roster.substitutePlayers.length } : null),
      catchError(() => of(null))
    );
  }

  private lastFinishedAnalysis(divisionId: string, matches: readonly Match[], activeTypeIds$: Observable<ReadonlySet<string> | null>): Observable<number | null> {
    const last = lastFinishedOf(matches.filter(match => match.divisionId === divisionId));
    if (!last) return of(null);
    return forkJoin({ events: this.eventService.getByMatchPostMatch(last.id), activeTypeIds: activeTypeIds$ }).pipe(
      map(({ events, activeTypeIds }) => analysisCoverage(events, activeTypeIds).percent),
      catchError(() => of(null))
    );
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
