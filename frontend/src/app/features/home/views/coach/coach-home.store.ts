import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, Subject, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LiveMatchSource } from '../../../../core/navigation/live-match.source';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { Match } from '../../../match/types/match.types';
import { shortTeamName } from '../../../match/post-match/utils/zone-grid';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { buildCoachBoard } from '../../domain/coach-board';
import { upcomingMatches } from '../../domain/division-match-state';
import { greetingFor, hudDateLabel } from '../../domain/greeting';
import { relativeMatchLabel, parseWallClock } from '../../domain/match-time';
import { coachRules, resolvePrimaryAction } from '../../domain/primary-action';
import { BoardModel, PrimaryAction, SUBSTITUTES_TARGET, WidgetState } from '../../types/home.types';
import { BoardExtras, CoachHomeDataService, DebtData, EMPTY_BOARD_EXTRAS, FormData } from './coach-home-data.service';

const ACTIVE_DIVISION_WIDGET = 'active-division';
const CLOCK_TICK_MS = 1000;

export interface PendingItem {
  kind: 'substitutes' | 'jerseys';
  text: string;
  detail: string;
  /** Ruta a la que lleva el botón. */
  route: string;
  actionLabel: string;
  requiresConnection: boolean;
}

export type CoachWidget = 'matches' | 'debt' | 'pending' | 'form';

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
      analysis: this.analysis()
    });
  });

  /** Mientras no llegan los partidos no hay tablero que mostrar. */
  readonly boardStatus = computed(() => this.divisions().length === 0 ? 'ready' : this.matchesState().status);

  /** Pendientes de la división: suplentes que faltan en el próximo partido y jugadores sin dorsal. */
  readonly pendingState = computed<WidgetState<PendingItem[]>>(() => {
    const jerseys = this.jerseyState();
    if (jerseys.status === 'loading' || this.matchesState().status === 'loading') return { status: 'loading' };
    if (jerseys.status === 'error') return jerseys;
    const items: PendingItem[] = [];
    const next = this.upcoming();
    const roster = this.extras().roster;
    const substitutes = roster?.substitutes ?? 0;
    const start = next && parseWallClock(next.date);
    if (next && start && substitutes < SUBSTITUTES_TARGET) {
      const missing = SUBSTITUTES_TARGET - substitutes;
      items.push({
        kind: 'substitutes',
        text: `Faltan ${missing} ${missing === 1 ? 'suplente' : 'suplentes'}`,
        detail: `vs ${shortTeamName(next.opponent.alias || next.opponent.name)} · ${relativeMatchLabel(start, this.now())}`,
        route: `/selection-roster/${next.id}`,
        actionLabel: 'Completar',
        requiresConnection: true
      });
    }
    const withoutJersey = jerseys.status === 'ready' ? jerseys.data : 0;
    const divisionId = this.activeDivisionId();
    if (withoutJersey > 0 && divisionId) {
      items.push({
        kind: 'jerseys',
        text: `${withoutJersey} ${withoutJersey === 1 ? 'jugador sin dorsal' : 'jugadores sin dorsal'}`,
        detail: `Plantel ${this.activeDivision()?.name ?? ''}`,
        route: `/divisions/${divisionId}/players`,
        actionLabel: 'Asignar',
        requiresConnection: true
      });
    }
    if (items.length === 0) return { status: 'empty' };
    return jerseys.status === 'ready'
      ? { status: 'ready', data: items, fetchedAt: jerseys.fetchedAt, stale: jerseys.stale }
      : { status: 'ready', data: items, fetchedAt: this.now().getTime(), stale: false };
  });

  readonly hudLabel = computed(() => `${hudDateLabel(this.now())} · ${this.userContext.currentClub()?.name ?? ''}`);
  readonly hudTitle = computed(() => `${greetingFor(this.now())}, ${this.userContext.userContext()?.firstName ?? ''}`.replace(/,\s*$/, ''));

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

    this.bind(() => this.data.boardExtras(this.upcoming(), this.captureMatch()), this.extras);
    this.bind(() => this.data.debt(this.divisionMatches()), this.debtState);
    this.bind(() => {
      const id = this.activeDivisionId();
      return id ? this.data.playersWithoutJersey(id) : of<WidgetState<number>>({ status: 'empty' });
    }, this.jerseyState);
    this.bind(() => this.data.form(this.divisionMatches(), this.now()), this.formState);
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
    if (this.divisions().length > 0) this.loadMatches$.next();
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
