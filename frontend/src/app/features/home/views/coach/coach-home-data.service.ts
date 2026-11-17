import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, from, map, of, shareReplay } from 'rxjs';
import { UserContextService } from '../../../../core/services/user-context.service';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { DivisionStatisticsService } from '../../../division-statistics/services/division-statistics.service';
import { Division } from '../../../division/types/division.types';
import { DivisionPlayerResponse } from '../../../division-player/type/division-player.types';
import { EventService } from '../../../match/services/event.service';
import { EventTypeService } from '../../../match/services/event-type.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { ZoneService } from '../../../match/services/zone.service';
import { MatchTimelineEventResponse } from '../../../match/types/event.types';
import { Match } from '../../../match/types/match.types';
import { loadActiveTypeIds } from '../../data/active-type-ids';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { ToWidgetStateOptions, toWidgetState } from '../../data/to-widget-state';
import { AnalysisCoverage, analysisCoverage, minutesWithoutZone } from '../../domain/analysis-coverage';
import { FocusInput } from '../../domain/focus-rows';
import { focusInputOf } from '../../domain/focus-series';
import { FormRecord, formRecord } from '../../domain/form-record';
import { lastFinishedOf, playedAt } from '../../domain/division-match-state';
import { seasonRange, shortDateLabel } from '../../domain/match-time';
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
  /** Jugadores activos de la división del próximo partido. */
  squadSize: number | null;
  progress: CaptureProgress | null;
  recent: LiveEventLine[];
}

export const EMPTY_BOARD_EXTRAS: BoardExtras = { roster: null, readyOffline: false, squadSize: null, progress: null, recent: [] };

const JERSEY_PAGE_SIZE = 200;
const RECENT_EVENTS = 3;

/** Lecturas del Inicio del entrenador; cada widget devuelve su `WidgetState` con snapshot offline. */
@Injectable()
export class CoachHomeDataService {
  private readonly matchService = inject(MatchService);
  private readonly rosterService = inject(RosterService);
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly zoneService = inject(ZoneService);
  private readonly playerService = inject(DivisionPlayerService);
  private readonly statisticsService = inject(DivisionStatisticsService);
  private readonly reader = inject(OfflineMatchReader);
  private readonly cache = inject(DashboardSnapshotCache);
  private readonly userContext = inject(UserContextService);
  private readonly connectivity = inject(ConnectivityService);

  /** Eventos post-partido por partido, compartidos entre Deuda y Forma dentro de una misma recarga. */
  private readonly eventsByMatch = new Map<string, Observable<MatchTimelineEventResponse[]>>();

  private activeTypeIds: Observable<ReadonlySet<string> | null> | null = null;

  /** Descarta los eventos y el catálogo guardados: lo llama el store al arrancar cada recarga, así Deuda y Forma piden una sola vez. */
  invalidateEvents(): void {
    this.eventsByMatch.clear();
    this.activeTypeIds = null;
  }

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
    const squad$ = next
      ? this.playerService.getActiveByDivisionId(next.divisionId, 1, 1).pipe(map(page => page.totalElements), catchError(() => of(null)))
      : of(null);
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
    return forkJoin({ roster: roster$, readyOffline: ready$, squadSize: squad$, live: live$ }).pipe(
      map(({ roster, readyOffline, squadSize, live }) => ({ roster, readyOffline, squadSize, progress: live.progress, recent: live.recent })),
      catchError(() => of(EMPTY_BOARD_EXTRAS))
    );
  }

  /** Análisis del último partido jugado (alimenta el tablero y el primario); vacío si todavía no hubo ninguno. */
  debt(matches: readonly Match[]): Observable<WidgetState<DebtData>> {
    const last = lastFinishedOf(matches);
    if (!last) return of<WidgetState<DebtData>>({ status: 'empty' });
    const played = playedAt(last);
    return forkJoin({
      coverage: this.coverageOf(last.id),
      zones: this.zoneService.list(last.id).pipe(catchError(() => of(null)))
    }).pipe(
      map(({ coverage, zones }): DebtData => {
        return {
          matchId: last.id,
          opponent: shortTeamName(last.opponent.alias || last.opponent.name),
          dateLabel: played ? shortDateLabel(played) : '',
          percent: coverage.percent,
          withoutPlayer: coverage.withoutPlayer,
          minutesWithoutZone: zones ? minutesWithoutZone(zones.assignments) : null
        };
      }),
      toWidgetState<DebtData>(this.options(`debt.${last.divisionId}`, { isEmpty: () => false }))
    );
  }

  /** Cantidad de jugadores activos de la división que todavía no tienen dorsal. */
  playersWithoutJersey(divisionId: string): Observable<WidgetState<number>> {
    return this.playerService.getActiveByDivisionId(divisionId, 1, JERSEY_PAGE_SIZE).pipe(
      map(page => (page.content as DivisionPlayerResponse[]).filter(player => player.jerseyNumber == null).length),
      toWidgetState<number>(this.options(`jerseys.${divisionId}`, { isEmpty: () => false }))
    );
  }

  /** Récord de la temporada y % de análisis de los últimos partidos. */
  form(matches: readonly Match[], now: Date): Observable<WidgetState<FormData>> {
    const record = formRecord(matches, now);
    if (!record) return of<WidgetState<FormData>>({ status: 'empty' });
    const percents$ = record.last.map(entry => this.coverageOf(entry.matchId).pipe(
      map(coverage => [entry.matchId, coverage.percent] as const),
      catchError(() => of([entry.matchId, null] as const))
    ));
    return forkJoin(percents$).pipe(
      map((pairs): FormData => ({ record, percents: Object.fromEntries(pairs) })),
      toWidgetState<FormData>(this.options(`form.${matches[0].divisionId}`, { isEmpty: () => false }))
    );
  }

  /** «Qué trabajar»: una sola llamada de estadísticas de la división en la temporada; el snapshot es por división. */
  focus(divisionId: string, now: Date): Observable<WidgetState<FocusInput>> {
    const { from, to } = seasonRange(now);
    return this.statisticsService.getDivisionStatistics(divisionId, from, to).pipe(
      map(response => focusInputOf(response.matches)),
      toWidgetState<FocusInput>(this.options(`focus.${divisionId}`, { isEmpty: () => false }))
    );
  }

  /** Cobertura con la misma regla que post-partido: eventos del partido y catálogo de tipos activos, ambos compartidos. */
  private coverageOf(matchId: string): Observable<AnalysisCoverage> {
    this.activeTypeIds ??= loadActiveTypeIds(this.eventTypeService).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return forkJoin({ events: this.eventsOf(matchId), activeTypeIds: this.activeTypeIds }).pipe(
      map(({ events, activeTypeIds }) => analysisCoverage(events, activeTypeIds))
    );
  }

  private eventsOf(matchId: string): Observable<MatchTimelineEventResponse[]> {
    const cached = this.eventsByMatch.get(matchId);
    if (cached) return cached;
    const shared = this.eventService.getByMatchPostMatch(matchId).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.eventsByMatch.set(matchId, shared);
    return shared;
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
