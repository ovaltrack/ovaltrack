import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { RugbyBallLoaderComponent } from 'src/app/shared/components/rugby-ball-loader/rugby-ball-loader.component';
import { PlayerStatsApiService } from './services/player-stats-api.service';
import { PlayerComparisonCardComponent } from './components/player-comparison-card/player-comparison-card.component';
import { PlayerZonesCardComponent } from './components/player-zones-card/player-zones-card.component';
import { PlayerActionsCardComponent } from './components/player-actions-card/player-actions-card.component';
import {
  PlayerMatchStatisticsResponse,
  PlayerMatchSummary,
  PlayerStatisticsQuery,
  PlayerStatisticsResponse,
} from './types/player-stats-api.types';
import { MatchResult, PlayerKpi } from './types/player-statistics.types';
import { formatDecimal, matchResult, tackleDetail, toActionGroups, toComparisonRows } from './utils/player-comparison';

/** Carga con estado explícito: la pantalla distingue cargando, listo y error sin banderas sueltas. */
type Load<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

const LOADING = { status: 'loading' } as const;

const RESULT_LABELS: Record<MatchResult, string> = { win: 'G', loss: 'P', draw: 'E' };
const RESULT_WORDS: Record<MatchResult, string> = { win: 'Ganado', loss: 'Perdido', draw: 'Empatado' };

function initialsOf(fullName: string): string {
  return fullName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
}

/**
 * Estadísticas de un jugador: generales (división y temporada, comparadas con el promedio del plantel) o de un partido.
 * El jugador entra a `/player-statistics`; el staff, a `/players/:personId/statistics`. Con `:matchId` muestra el partido.
 */
@Component({
  selector: 'app-player-statistics',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    RugbyBallLoaderComponent,
    PlayerComparisonCardComponent,
    PlayerZonesCardComponent,
    PlayerActionsCardComponent,
  ],
  templateUrl: './player-statistics.component.html',
  styleUrl: './player-statistics.component.css',
})
export class PlayerStatisticsComponent {
  private readonly api = inject(PlayerStatsApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userContext = inject(UserContextService);

  private readonly params = toSignal(
    this.route.paramMap.pipe(map(params => ({ personId: params.get('personId'), matchId: params.get('matchId') }))),
    { initialValue: { personId: null, matchId: null } }
  );

  /** Sin `personId` en la ruta, el jugador ve sus propias estadísticas. */
  readonly isOwnView = computed(() => this.params().personId === null);
  readonly personId = computed(() => this.params().personId ?? this.userContext.personId());
  readonly matchId = computed(() => this.params().matchId);
  readonly view = computed<'general' | 'match'>(() => (this.matchId() ? 'match' : 'general'));

  /** División y temporada elegidas; vacío = las más recientes que elija el backend. */
  readonly query = signal<PlayerStatisticsQuery>({});

  readonly general = toSignal(
    toObservable(computed(() => ({ personId: this.personId(), query: this.query() }))).pipe(
      filter((request): request is { personId: string; query: PlayerStatisticsQuery } => request.personId !== null),
      switchMap(({ personId, query }) => this.load(this.api.getGeneral(personId, query), 'las estadísticas del jugador'))
    ),
    { initialValue: LOADING as Load<PlayerStatisticsResponse> }
  );

  readonly matchDetail = toSignal(
    toObservable(computed(() => ({ personId: this.personId(), matchId: this.matchId() }))).pipe(
      distinctUntilChanged((a, b) => a.personId === b.personId && a.matchId === b.matchId),
      filter((request): request is { personId: string; matchId: string } => !!request.personId && !!request.matchId),
      switchMap(({ personId, matchId }) => this.load(this.api.getMatch(personId, matchId), 'las estadísticas del partido'))
    ),
    { initialValue: LOADING as Load<PlayerMatchStatisticsResponse> }
  );

  readonly data = computed(() => {
    const state = this.general();
    return state.status === 'ready' ? state.data : null;
  });

  readonly detail = computed(() => {
    const state = this.matchDetail();
    return state.status === 'ready' && state.data.match.matchId === this.matchId() ? state.data : null;
  });

  readonly ownClubName = computed(() => this.userContext.currentClub()?.name ?? 'Mi club');
  readonly fullName = computed(() => this.data()?.fullName ?? this.detail()?.fullName ?? '');
  readonly initials = computed(() => initialsOf(this.fullName()));
  readonly resultLabels = RESULT_LABELS;
  readonly resultWords = RESULT_WORDS;

  readonly matches = computed<PlayerMatchSummary[]>(() => this.data()?.matches ?? []);
  readonly hasMatches = computed(() => this.matches().length > 0);

  readonly subtitle = computed(() => {
    const data = this.data();
    if (!data?.divisionName) return 'Sin división asignada';
    return data.season ? `${data.divisionName} · Temporada ${data.season}` : data.divisionName;
  });

  // --- General ---
  readonly generalKpis = computed<PlayerKpi[]>(() => {
    const data = this.data();
    if (!data) return [];
    const played = data.matches.length;
    const starts = data.matches.filter(m => m.role === 'TITULAR').length;
    const results = data.matches.map(matchResult);
    const count = (result: MatchResult) => results.filter(r => r === result).length;
    const perMatch = (value: number) => (played === 0 ? '0' : formatDecimal(value / played));
    return [
      { label: 'Partidos', value: `${played}`, detail: `${starts} titular · ${played - starts} suplente` },
      { label: 'Puntos', value: `${data.totals.points}`, detail: `${perMatch(data.totals.points)} por partido` },
      { label: 'Tries', value: `${data.totals.tries}`, detail: `${perMatch(data.totals.tries)} por partido` },
      { label: 'Tackles', value: `${data.totals.tacklesMade}`, detail: tackleDetail(data.totals) },
      { label: 'Récord jugando', value: `${count('win')}-${count('loss')}-${count('draw')}`, detail: 'G · P · E' },
    ];
  });

  readonly generalRows = computed(() => toComparisonRows(this.data()?.comparisons ?? []));
  readonly generalActions = computed(() => toActionGroups(this.data()?.actions ?? []));

  // --- Partido ---
  readonly matchKpis = computed<PlayerKpi[]>(() => {
    const detail = this.detail();
    if (!detail) return [];
    const { match } = detail;
    return [
      { label: 'Puntos', value: `${match.metrics.points}`, detail: 'Conseguidos por el jugador' },
      { label: 'Tries', value: `${match.metrics.tries}`, detail: 'Apoyados' },
      { label: 'Tackles', value: `${match.metrics.tacklesMade}`, detail: tackleDetail(match.metrics) },
      { label: 'Turnovers', value: `${match.metrics.turnoversWon}`, detail: 'Ganados (solo los cargados con jugador)' },
      { label: 'Acciones', value: `${match.metrics.actions}`, detail: 'Eventos con el jugador' },
    ];
  });

  readonly matchRows = computed(() => toComparisonRows(this.detail()?.comparisons ?? []));
  readonly matchActions = computed(() => toActionGroups(this.detail()?.actions ?? []));

  readonly matchSquadLabel = computed(() => {
    const detail = this.detail();
    return detail ? `Promedio de los ${detail.squadSize} jugadores del plantel de este partido` : '';
  });

  readonly backLink = computed<string[] | null>(() => {
    const divisionId = this.data()?.divisionId;
    return this.isOwnView() || !divisionId ? null : ['/divisions', divisionId, 'players'];
  });

  // --- Navegación ---
  setDivision(divisionId: string): void {
    this.query.set({ divisionId, season: null });
    this.openGeneral();
  }

  setSeason(season: string): void {
    this.query.update(query => ({ ...query, divisionId: query.divisionId ?? this.data()?.divisionId, season: Number(season) }));
  }

  openGeneral(): void {
    this.router.navigate(this.baseRoute());
  }

  openMatch(matchId: string): void {
    this.router.navigate([...this.baseRoute(), matchId]);
  }

  /** "Por partido" sin partido elegido abre el más reciente. */
  openMatchView(): void {
    const latest = this.matches()[0];
    if (latest) this.openMatch(latest.matchId);
  }

  resultOf(match: PlayerMatchSummary): MatchResult {
    return matchResult(match);
  }

  private baseRoute(): string[] {
    const personId = this.params().personId;
    return personId ? ['/players', personId, 'statistics'] : ['/player-statistics'];
  }

  private load<T>(request: Observable<T>, what: string): Observable<Load<T>> {
    return request.pipe(
      map(data => ({ status: 'ready', data }) as Load<T>),
      catchError((error: unknown) => {
        const message = (error instanceof HttpErrorResponse && error.error?.message) || `No se pudieron cargar ${what}.`;
        this.toast.error(message);
        return of({ status: 'error', message } as Load<T>);
      }),
      startWith(LOADING as Load<T>)
    );
  }
}
