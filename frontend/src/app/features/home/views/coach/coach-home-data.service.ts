import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, from, map, of } from 'rxjs';
import { UserContextService } from '../../../../core/services/user-context.service';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { Division } from '../../../division/types/division.types';
import { DivisionPlayerResponse } from '../../../division-player/type/division-player.types';
import { EventService } from '../../../match/services/event.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { ZoneService } from '../../../match/services/zone.service';
import { Match } from '../../../match/types/match.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { ToWidgetStateOptions, toWidgetState } from '../../data/to-widget-state';
import { analysisCoverage, minutesWithoutZone } from '../../domain/analysis-coverage';
import { FormRecord, formRecord } from '../../domain/form-record';
import { lastFinishedOf, playedAt } from '../../domain/division-match-state';
import { shortDateLabel } from '../../domain/match-time';
import { LiveEventLine, WidgetState } from '../../types/home.types';
import { shortTeamName } from '../../../match/post-match/utils/zone-grid';
import { CaptureProgress } from '../../data/offline-match-reader';

export interface DebtData {
  matchId: string;
  opponent: string;
  /** "1 nov". */
  dateLabel: string;
  /** 0–100; el % de jugadas con jugador asignado. */
  percent: number;
  withoutPlayer: number;
  /** `null` si no se pudieron leer los tramos de zona. */
  minutesWithoutZone: number | null;
}

export interface FormData {
  record: FormRecord;
  /** % de análisis por partido; `null` si no se pudo leer. */
  percents: Record<string, number | null>;
}

/** Lo que el tablero necesita además de la lista de partidos; nunca falla: sin dato queda el valor neutro. */
export interface BoardExtras {
  roster: { starters: number; substitutes: number } | null;
  readyOffline: boolean;
  progress: CaptureProgress | null;
  recent: LiveEventLine[];
}

export const EMPTY_BOARD_EXTRAS: BoardExtras = { roster: null, readyOffline: false, progress: null, recent: [] };

const JERSEY_PAGE_SIZE = 200;
const RECENT_EVENTS = 3;

/** Lecturas del Inicio del entrenador; cada widget devuelve su `WidgetState` con snapshot offline. */
@Injectable()
export class CoachHomeDataService {
  private readonly matchService = inject(MatchService);
  private readonly rosterService = inject(RosterService);
  private readonly eventService = inject(EventService);
  private readonly zoneService = inject(ZoneService);
  private readonly playerService = inject(DivisionPlayerService);
  private readonly reader = inject(OfflineMatchReader);
  private readonly cache = inject(DashboardSnapshotCache);
  private readonly userContext = inject(UserContextService);
  private readonly connectivity = inject(ConnectivityService);

  /** Partidos de todas las divisiones; una división que falla no tumba a las demás, salvo que fallen todas. */
  matches(divisions: readonly Division[]): Observable<WidgetState<Match[]>> {
    const loads = divisions.map(division => this.matchService.getAllMatchesByDivisionId(division.id).pipe(
      map(matches => ({ ok: true, matches })),
      catchError(() => of({ ok: false, matches: [] as Match[] }))
    ));
    return forkJoin(loads).pipe(
      map(results => {
        if (results.length > 0 && results.every(result => !result.ok)) throw new Error('matches');
        return results.flatMap(result => result.matches);
      }),
      toWidgetState<Match[]>(this.options('matches'))
    );
  }

  /** Nómina, "listo sin señal" y, si este dispositivo captura el partido, período, reloj y últimos eventos. */
  boardExtras(next: Match | null, capture: Match | null): Observable<BoardExtras> {
    const roster$ = next
      ? this.rosterService.getSavedRoster(next.id).pipe(
          map(roster => roster ? { starters: roster.startingPlayers.length, substitutes: roster.substitutePlayers.length } : null),
          catchError(() => of(null)))
      : of(null);
    const ready$ = next ? from(this.reader.isReadyOffline(next)) : of(false);
    const live$ = capture
      ? from(Promise.all([
          this.reader.captureProgress(capture.id),
          this.reader.recentEvents(capture.id, RECENT_EVENTS),
          this.reader.eventTypeNames()
        ])).pipe(map(([progress, events, names]) => ({
          progress,
          recent: events.map((event): LiveEventLine => ({
            label: names[event.eventTypeId] ?? 'Evento',
            minute: `${Math.floor((event.matchTime ?? 0) / 60)}'`
          }))
        })))
      : of({ progress: null, recent: [] as LiveEventLine[] });
    return forkJoin({ roster: roster$, readyOffline: ready$, live: live$ }).pipe(
      map(({ roster, readyOffline, live }) => ({ roster, readyOffline, progress: live.progress, recent: live.recent })),
      catchError(() => of(EMPTY_BOARD_EXTRAS))
    );
  }

  /** Deuda de análisis del último partido jugado; vacío si todavía no hubo ninguno. */
  debt(matches: readonly Match[]): Observable<WidgetState<DebtData>> {
    const last = lastFinishedOf(matches);
    if (!last) return of<WidgetState<DebtData>>({ status: 'empty' });
    const played = playedAt(last);
    return forkJoin({
      events: this.eventService.getByMatchPostMatch(last.id),
      zones: this.zoneService.list(last.id).pipe(catchError(() => of(null)))
    }).pipe(
      map(({ events, zones }): DebtData => {
        const coverage = analysisCoverage(events);
        return {
          matchId: last.id,
          opponent: shortTeamName(last.opponent.alias || last.opponent.name),
          dateLabel: played ? shortDateLabel(played) : '',
          percent: coverage.percent,
          withoutPlayer: coverage.withoutPlayer,
          minutesWithoutZone: zones ? minutesWithoutZone(zones.assignments) : null
        };
      }),
      toWidgetState<DebtData>(this.options('debt', { isEmpty: () => false }))
    );
  }

  /** Cantidad de jugadores activos de la división que todavía no tienen dorsal. */
  playersWithoutJersey(divisionId: string): Observable<WidgetState<number>> {
    return this.playerService.getActiveByDivisionId(divisionId, 1, JERSEY_PAGE_SIZE).pipe(
      map(page => (page.content as DivisionPlayerResponse[]).filter(player => player.jerseyNumber == null).length),
      toWidgetState<number>(this.options('jerseys', { isEmpty: () => false }))
    );
  }

  /** Récord de la temporada y % de análisis de los últimos partidos. */
  form(matches: readonly Match[], now: Date): Observable<WidgetState<FormData>> {
    const record = formRecord(matches, now);
    if (!record) return of<WidgetState<FormData>>({ status: 'empty' });
    const percents$ = record.last.map(entry => this.eventService.getByMatchPostMatch(entry.matchId).pipe(
      map(events => [entry.matchId, analysisCoverage(events).percent] as const),
      catchError(() => of([entry.matchId, null] as const))
    ));
    return forkJoin(percents$).pipe(
      map((pairs): FormData => ({ record, percents: Object.fromEntries(pairs) })),
      toWidgetState<FormData>(this.options('form', { isEmpty: () => false }))
    );
  }

  /** Snapshot por usuario y modo offline para el widget indicado. */
  private options<T>(widget: string, extra: Partial<ToWidgetStateOptions<T>> = {}): ToWidgetStateOptions<T> {
    const userId = this.userContext.userContext()?.userId;
    return {
      ...extra,
      offline: !this.connectivity.online(),
      snapshot: userId
        ? {
            read: () => this.cache.read<T>(userId, `coach.${widget}`),
            write: (data, fetchedAt) => this.cache.write(userId, `coach.${widget}`, data, fetchedAt)
          }
        : undefined
    };
  }
}
