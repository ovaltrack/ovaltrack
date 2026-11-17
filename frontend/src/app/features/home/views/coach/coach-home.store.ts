import { DestroyRef, Injectable, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LiveMatchSource } from '../../../../core/navigation/live-match.source';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { Match } from '../../../match/types/match.types';
import { shortTeamName } from '../../../match/post-match/utils/zone-grid';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { buildCoachBoard } from '../../domain/coach-board';
import { FocusInput } from '../../domain/focus-rows';
import { upcomingMatches } from '../../domain/division-match-state';
import { greetingFor, hudDateLabel } from '../../domain/greeting';
import { relativeMatchLabel, parseWallClock } from '../../domain/match-time';
import { PendingRow, pendingRows } from '../../domain/pending-rows';
import { UpcomingFixture, upcomingFixtures } from '../../domain/upcoming-fixtures';
import { coachRules, resolvePrimaryAction } from '../../domain/primary-action';
import { BoardModel, PrimaryAction, WidgetState, isRefreshing } from '../../types/home.types';
import { BoardExtras, CoachHomeDataService, DebtData, EMPTY_BOARD_EXTRAS, FormData } from './coach-home-data.service';

const ACTIVE_DIVISION_WIDGET = 'active-division';
const CLOCK_TICK_MS = 1000;

export type CoachWidget = 'matches' | 'pending' | 'form' | 'focus';

const loading = <T>(): WritableSignal<WidgetState<T>> => signal<WidgetState<T>>({ status: 'loading' });

/** Estado del Inicio del entrenador. Se provee en la vista, así se destruye al salir. */
@Injectable()
export class CoachHomeStore {
  private readonly data = inject(CoachHomeDataService);
  private readonly liveSource = inject(LiveMatchSource);
  private readonly userContext = inject(UserContextService);
  private readonly cache = inject(DashboardSnapshotCache);
  private readonly destroyRef = inject(DestroyRef);
  readonly online = inject(ConnectivityService).online;

  readonly now = signal(new Date());

  readonly matchesState = loading<Match[]>();
  readonly debtState = loading<DebtData>();
  readonly jerseyState = loading<number>();
  readonly formState = loading<FormData>();
  readonly focusState = loading<FocusInput>();
  readonly extras = signal<BoardExtras>(EMPTY_BOARD_EXTRAS);

  readonly divisions = computed(() => this.userContext.activeDivisions().filter(division => division.active));
  readonly captureMatchId = computed(() => this.liveSource.liveMatch()?.matchId ?? null);
  private readonly allMatches = computed(() => {
    const state = this.matchesState();
    return state.status === 'ready' ? state.data : [];
  });

  /** Pestaña elegida con un clic en esta sesión; gana sobre el salto automático y sobre la recordada. */
  private readonly picked = signal<string | null>(null);
  private readonly captureDivisionId = computed(() =>
    this.allMatches().find(match => match.id === this.captureMatchId())?.divisionId ?? null);

  /** Elegida con un clic > división del partido que captura este dispositivo > última recordada > primera. */
  readonly activeDivisionId = computed<string | null>(() => {
    const ids = this.divisions().map(division => division.id);
    const remembered = this.userId() ? this.cache.read<string>(this.userId()!, ACTIVE_DIVISION_WIDGET)?.data ?? null : null;
    const candidates = [this.picked(), this.captureDivisionId(), remembered];
    return candidates.find((id): id is string => id !== null && ids.includes(id)) ?? ids[0] ?? null;
  });
  readonly activeDivision = computed(() => this.divisions().find(division => division.id === this.activeDivisionId()) ?? null);
  readonly divisionMatches = computed(() => this.allMatches().filter(match => match.divisionId === this.activeDivisionId()));

  private readonly upcoming = computed(() => upcomingMatches(this.divisionMatches(), this.now())[0] ?? null);

  readonly primary = computed<PrimaryAction | null>(() => {
    if (this.divisions().length === 0) return null;
    const debt = this.debtState();
    return resolvePrimaryAction(coachRules, {
      now: this.now(),
      matches: this.divisionMatches(),
      captureMatchId: this.captureMatchId(),
      nextRoster: this.extras().roster,
      lastFinished: debt.status === 'ready' ? { id: debt.data.matchId, analysisPercent: debt.data.percent, minutesWithoutZone: debt.data.minutesWithoutZone } : null
    });
  });

  /** Análisis del último partido jugado, tal como lo ve el tablero; `null` mientras no se conoce. */
  private readonly analysis = computed(() => {
    const debt = this.debtState();
    return debt.status === 'ready'
      ? { percent: debt.data.percent, withoutPlayer: debt.data.withoutPlayer, minutesWithoutZone: debt.data.minutesWithoutZone }
      : null;
  });

  readonly board = computed<BoardModel>(() => {
    if (this.divisions().length === 0) return { kind: 'onboarding', step: 'await-division' };
    const extras = this.extras();
    return buildCoachBoard({
      now: this.now(),
      divisionName: this.activeDivision()?.name ?? '',
      matches: this.divisionMatches(),
      captureMatchId: this.captureMatchId(),
      progress: extras.progress,
      recent: extras.recent,
      roster: extras.roster,
      readyOffline: extras.readyOffline,
      squadSize: extras.squadSize,
      analysis: this.analysis()
    });
  });

  /** Mientras no llegan los partidos no hay tablero que mostrar. */
  readonly boardStatus = computed(() => this.divisions().length === 0 ? 'ready' : this.matchesState().status);

  /** Algún widget muestra un dato viejo mientras llega el real, o los partidos todavía no tienen nada que mostrar. */
  readonly refreshing = computed(() =>
    this.matchesState().status === 'loading'
    || [this.matchesState(), this.debtState(), this.jerseyState(), this.formState(), this.focusState()].some(isRefreshing));

  /** Pendientes de la división (ver `pendingRows`): lo que el tablero ya pide no se repite acá. */
  readonly pendingState = computed<WidgetState<PendingRow[]>>(() => {
    const jerseys = this.jerseyState();
    if (jerseys.status === 'loading' || this.matchesState().status === 'loading' || this.debtState().status === 'loading') return { status: 'loading' };
    if (jerseys.status === 'error') return jerseys;
    const divisionId = this.activeDivisionId();
    if (!divisionId) return { status: 'empty' };
    const next = this.upcoming();
    const start = next && parseWallClock(next.date);
    const debt = this.debtState();
    const rows = pendingRows({
      board: this.board(),
      divisionId,
      divisionName: this.activeDivision()?.name ?? '',
      analysis: debt.status === 'ready' ? debt.data : null,
      next: next && start ? { id: next.id, status: next.status, opponent: shortTeamName(next.opponent.alias || next.opponent.name), whenLabel: relativeMatchLabel(start, this.now()) } : null,
      roster: this.extras().roster,
      withoutJersey: jerseys.status === 'ready' ? jerseys.data : 0
    });
    if (rows.length === 0) return { status: 'empty' };
    return jerseys.status === 'ready'
      ? { status: 'ready', data: rows, fetchedAt: jerseys.fetchedAt, stale: jerseys.stale }
      : { status: 'ready', data: rows, fetchedAt: this.now().getTime(), stale: false };
  });

  /** Próximas fechas de la división activa, sobre los partidos ya cargados (sin otra llamada). */
  readonly upcomingState = computed<WidgetState<UpcomingFixture[]>>(() => {
    const matches = this.matchesState();
    if (matches.status !== 'ready') return matches.status === 'empty' ? { status: 'empty' } : matches;
    const fixtures = upcomingFixtures(this.divisionMatches(), this.now(), this.extras().roster);
    return fixtures.length === 0 ? { status: 'empty' } : { status: 'ready', data: fixtures, fetchedAt: matches.fetchedAt, stale: matches.stale };
  });

  readonly hudLabel = computed(() => `${hudDateLabel(this.now())} · ${this.userContext.currentClub()?.name ?? ''}`);
  readonly hudTitle = computed(() => `${greetingFor(this.now())}, ${this.userContext.userContext()?.firstName ?? ''}`.replace(/,\s*$/, ''));

  /** Identifica las divisiones activas: cambia solo si cambian las divisiones, no cada vez que se reemplaza el contexto. */
  private readonly divisionKey = computed(() => this.divisions().map(division => division.id).join(','));
  private loadedKey: string | null = null;

  private readonly loadMatches$ = new Subject<void>();
  private readonly derive$ = new Subject<void>();
  private started = false;

  constructor() {
    this.loadMatches$.pipe(
      switchMap(() => this.data.matches(this.divisions()).pipe(
        tap(state => {
          this.matchesState.set(state);
          if (state.status !== 'loading') this.refreshDerived();
        }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    // El contexto puede llegar de Dexie y corregirse después con /api/me: si cambian las divisiones, se recargan los partidos.
    effect(() => {
      const key = this.divisionKey();
      untracked(() => {
        if (this.started && key !== this.loadedKey) this.reload();
      });
    });

    this.bind(() => this.data.boardExtras(this.upcoming(), this.captureMatch()), this.extras);
    this.bind(() => this.data.debt(this.divisionMatches()), this.debtState);
    this.bind(() => {
      const id = this.activeDivisionId();
      return id ? this.data.playersWithoutJersey(id) : of<WidgetState<number>>({ status: 'empty' });
    }, this.jerseyState);
    this.bind(() => this.data.form(this.divisionMatches(), this.now()), this.formState);
    this.bind(() => {
      const id = this.activeDivisionId();
      return id ? this.data.focus(id, this.now()) : of<WidgetState<FocusInput>>({ status: 'empty' });
    }, this.focusState);
  }

  /** Arranca la carga y el reloj de 1 s; el reloj se corta al destruirse la vista. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const timer = setInterval(() => this.now.set(new Date()), CLOCK_TICK_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    this.reload();
  }

  reload(): void {
    if (this.divisions().length === 0) return;
    this.loadedKey = this.divisionKey();
    this.loadMatches$.next();
  }

  /** Vuelve a cargar lo que depende de la división activa y del partido que captura este dispositivo. */
  refreshDerived(): void {
    this.data.invalidateEvents();
    this.derive$.next();
  }

  selectDivision(divisionId: string): void {
    this.picked.set(divisionId);
    const userId = this.userId();
    if (userId) this.cache.write(userId, ACTIVE_DIVISION_WIDGET, divisionId);
    this.refreshDerived();
  }

  retry(widget: CoachWidget): void {
    if (widget === 'matches') this.reload();
    else this.refreshDerived();
  }

  private userId(): string | null {
    return this.userContext.userContext()?.userId ?? null;
  }

  private captureMatch(): Match | null {
    const id = this.captureMatchId();
    return this.divisionMatches().find(match => match.id === id && (match.status === 'in_progress' || match.status === 'halftime')) ?? null;
  }

  /** Un solo `subscribe` por flujo: cada disparo cancela la carga anterior y escribe su resultado en el signal. */
  private bind<T>(load: () => Observable<T>, target: WritableSignal<T>): void {
    this.derive$.pipe(
      switchMap(() => load().pipe(tap(value => target.set(value)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}
