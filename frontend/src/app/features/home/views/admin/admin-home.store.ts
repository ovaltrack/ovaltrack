import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, switchMap, tap } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { Match } from '../../../match/types/match.types';
import { clubKpis, ClubKpi } from '../../domain/club-kpis';
import { DivisionStat, DivisionStatusRow, divisionStatusRows } from '../../domain/division-status';
import { buildAdminBoard } from '../../domain/admin-board';
import { rosterWindowMatches } from '../../domain/club-agenda';
import { urgentOf } from '../../domain/club-urgent';
import { greetingFor, hudDateLabel } from '../../domain/greeting';
import { parseWallClock } from '../../domain/match-time';
import { LINEUP_WINDOW_MS, adminRules, resolvePrimaryAction } from '../../domain/primary-action';
import { BoardModel, PrimaryAction, WidgetState, dataOf, isRefreshing } from '../../types/home.types';
import { AdminHomeDataService, RosterCounts } from './admin-home-data.service';

const CLOCK_TICK_MS = 1000;

export type AdminWidget = 'matches' | 'divisions';

/** Estado del Inicio del administrador del club: agenda, KPIs y estado de las divisiones. Se provee en la vista, así se destruye al salir. */
@Injectable()
export class AdminHomeStore {
  private readonly data = inject(AdminHomeDataService);
  private readonly userContext = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);
  readonly online = inject(ConnectivityService).online;

  readonly now = signal(new Date());

  readonly matchesState = signal<WidgetState<Match[]>>({ status: 'loading' });
  readonly statsState = signal<WidgetState<DivisionStat[]>>({ status: 'loading' });
  readonly rosters = signal<RosterCounts>({});

  readonly club = this.userContext.currentClub;
  readonly divisions = computed(() => this.userContext.activeDivisions().filter(division => division.active));
  readonly matches = computed(() => dataOf(this.matchesState()) ?? []);
  private readonly stats = computed(() => dataOf(this.statsState()) ?? []);

  /** Mientras no se conocen los entrenadores, no se acusa a ninguna división de no tener. */
  private readonly divisionsForRules = computed(() => this.divisions().map(division => {
    const stat = this.stats().find(candidate => candidate.divisionId === division.id);
    return { id: division.id, name: division.name, hasCoach: stat?.staff == null || stat.staff > 0 };
  }));

  readonly board = computed<BoardModel>(() => buildAdminBoard({
    now: this.now(), divisions: this.divisionsForRules(), matches: this.matches(), rosters: this.rosters(),
    urgent: urgentOf(this.primary(), { now: this.now(), divisions: this.divisions(), matches: this.matches(), rosters: this.rosters() })
  }));

  readonly boardStatus = computed(() => this.divisions().length === 0 ? 'ready' : this.matchesState().status);

  readonly primary = computed<PrimaryAction | null>(() => {
    const action = resolvePrimaryAction(adminRules, {
      now: this.now(), divisions: this.divisionsForRules(), matches: this.matches(), rosters: this.rosters()
    });
    if (!action || action.kind !== 'define-lineup') return action;
    const match = this.matches().find(candidate => action.route.endsWith(candidate.id));
    const division = this.divisions().find(candidate => candidate.id === match?.divisionId);
    return division ? { ...action, label: `Definir alineación ${division.name}` } : action;
  });

  /** Algún widget muestra un dato viejo mientras llega el real, o los partidos todavía no tienen nada que mostrar. */
  readonly refreshing = computed(() =>
    this.matchesState().status === 'loading' || [this.matchesState(), this.statsState()].some(isRefreshing));

  /** Una fila por división, en el orden del club (D4); sigue el estado de las estadísticas por división. */
  readonly statusState = computed<WidgetState<DivisionStatusRow[]>>(() => {
    const state = this.statsState();
    if (state.status !== 'ready') return state as WidgetState<DivisionStatusRow[]>;
    const rows = divisionStatusRows({ now: this.now(), divisions: this.divisions(), stats: state.data, matches: this.matches() });
    return rows.length === 0 ? { status: 'empty' } : { status: 'ready', data: rows, fetchedAt: state.fetchedAt, stale: state.stale };
  });

  /** KPIs del club; mientras no se conocen las estadísticas no se dibuja ningún número (sin ceros provisorios). */
  readonly kpisState = computed<WidgetState<ClubKpi[]>>(() => {
    const status = this.statusState();
    const stats = this.statsState();
    if (status.status !== 'ready' || stats.status !== 'ready') return status as WidgetState<ClubKpi[]>;
    return { status: 'ready', data: clubKpis(status.data, stats.data, this.matches(), this.now()), fetchedAt: status.fetchedAt, stale: status.stale };
  });

  readonly hudLabel = computed(() => `${hudDateLabel(this.now())} · Panel del club`);
  readonly hudTitle = computed(() => `${greetingFor(this.now())}, ${this.userContext.userContext()?.firstName ?? ''}`.replace(/,\s*$/, ''));
  readonly hudSubtitle = computed(() => {
    const count = this.divisions().length;
    return `${this.club()?.name ?? ''} · ${count} ${count === 1 ? 'división' : 'divisiones'}`;
  });

  private readonly loadMatches$ = new Subject<void>();
  private readonly derive$ = new Subject<void>();
  private started = false;

  constructor() {
    this.loadMatches$.pipe(
      switchMap(() => this.data.matches(this.club()?.id ?? '').pipe(
        tap(state => {
          this.matchesState.set(state);
          if (state.status !== 'loading') this.derive$.next();
        }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    this.bind(() => this.data.rosters(rosterWindowMatches(this.matches(), this.now(), LINEUP_WINDOW_MS)), this.rosters);
    this.bind(() => this.data.divisionStats(this.divisions(), this.matches(), this.now()), this.statsState,
      (next, current) => !(next.status === 'loading' && current.status === 'ready'));
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
    if (this.divisions().length > 0 && this.club()) this.loadMatches$.next();
  }

  retry(widget: AdminWidget): void {
    if (widget === 'matches') this.reload();
    else this.derive$.next();
  }

  /** `accept` decide si un valor nuevo reemplaza al actual: así un refresco no vuelve a "loading" lo que ya tiene datos. */
  private bind<T>(load: () => Observable<T>, target: WritableSignal<T>, accept: (next: T, current: T) => boolean = () => true): void {
    this.derive$.pipe(
      switchMap(() => load().pipe(tap(value => {
        if (accept(value, target())) target.set(value);
      }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}
