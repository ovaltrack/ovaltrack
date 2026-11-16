import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, tap } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { greetingFor, hudDateLabel } from '../../domain/greeting';
import { playerRules, resolvePrimaryAction } from '../../domain/primary-action';
import { BoardModel, PrimaryAction, WidgetState, dataOf } from '../../types/home.types';
import { PlayerSummary } from '../../domain/player-summary';
import { matchTakeaways } from '../../domain/match-takeaways';
import { SeasonKpi, seasonKpis } from '../../domain/season-kpis';
import { SquadComparison, squadComparison } from '../../domain/squad-comparison';
import { TackleColumns, tackleColumns } from '../../domain/tackle-columns';
import { PlayerHomeDataService, PlayerSeasonData } from './player-home-data.service';

const CLOCK_TICK_MS = 1000;

/** Estado del Inicio del jugador. Se provee en la vista, así se destruye al salir. */
@Injectable()
export class PlayerHomeStore {
  private readonly data = inject(PlayerHomeDataService);
  private readonly userContext = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);
  readonly online = inject(ConnectivityService).online;

  readonly now = signal(new Date());
  readonly summaryState = signal<WidgetState<PlayerSummary>>({ status: 'loading' });
  readonly seasonState = signal<WidgetState<PlayerSeasonData>>({ status: 'loading' });

  readonly summary = computed(() => dataOf(this.summaryState()));

  readonly board = computed<BoardModel>(() => {
    const last = this.summary()?.last;
    if (!last) return { kind: 'onboarding', step: 'no-matches-player' };
    const season = dataOf(this.seasonState());
    return { kind: 'player-last', ...last, takeaways: season ? matchTakeaways(season.matches, last.matchId, last.analysisPercent) : null };
  });

  /** «Mi temporada»: los KPIs del año según el backend; sin partidos o sin persona asociada, vacío. */
  readonly seasonKpisState = computed<WidgetState<SeasonKpi[]>>(() => {
    const state = this.seasonState();
    if (state.status !== 'ready') return state as WidgetState<SeasonKpi[]>;
    const kpis = seasonKpis(state.data.totals, state.data.matches);
    return kpis ? { status: 'ready', data: kpis, fetchedAt: state.fetchedAt, stale: state.stale } : { status: 'empty' };
  });

  /** «Vos contra el plantel»: sale de la misma respuesta de temporada, sin otra llamada. */
  readonly comparisonState = computed<WidgetState<SquadComparison>>(() => {
    const state = this.seasonState();
    if (state.status !== 'ready') return state as WidgetState<SquadComparison>;
    const comparison = squadComparison(state.data.comparisons ?? []);
    return comparison ? { status: 'ready', data: comparison, fetchedAt: state.fetchedAt, stale: state.stale } : { status: 'empty' };
  });

  /** «Tus tackles»: los últimos partidos de la misma respuesta de temporada. */
  readonly tacklesState = computed<WidgetState<TackleColumns>>(() => {
    const state = this.seasonState();
    if (state.status !== 'ready') return state as WidgetState<TackleColumns>;
    const columns = tackleColumns(state.data.matches, state.data.comparisons ?? []);
    return columns ? { status: 'ready', data: columns, fetchedAt: state.fetchedAt, stale: state.stale } : { status: 'empty' };
  });

  /** La temporada incluye el último partido y su análisis todavía no está completo: sus números pueden cambiar. */
  readonly seasonProvisional = computed(() => {
    const last = this.summary()?.last;
    const season = dataOf(this.seasonState());
    return !!last && last.analysisPercent < 100 && !!season?.matches.some(match => match.matchId === last.matchId);
  });

  readonly primary = computed<PrimaryAction | null>(() =>
    resolvePrimaryAction(playerRules, { lastMatchId: this.summary()?.last.matchId ?? null }));

  private readonly division = computed(() => this.userContext.activeDivisions()[0]?.name);

  /** "M18 · 2026": rótulo de la tarjeta de temporada. */
  readonly seasonLabel = computed(() => [this.division(), this.now().getFullYear()].filter(Boolean).join(' · '));

  /** "M18 · Puerto Madryn RC": la división sale del contexto del usuario. */
  readonly hudSubtitle = computed(() => {
    const division = this.division();
    const club = this.userContext.currentClub()?.name;
    return [division, club].filter(Boolean).join(' · ');
  });
  readonly hudLabel = computed(() => `${hudDateLabel(this.now())} · Mi panel`);
  readonly hudTitle = computed(() => `${greetingFor(this.now())}, ${this.userContext.userContext()?.firstName ?? ''}`.replace(/,\s*$/, ''));

  private readonly load$ = new Subject<void>();
  private started = false;

  constructor() {
    this.load$.pipe(
      switchMap(() => this.data.summary().pipe(tap(state => this.summaryState.set(state)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    this.load$.pipe(
      switchMap(() => this.data.season(this.now()).pipe(tap(state => this.seasonState.set(state)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
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
    this.load$.next();
  }
}
