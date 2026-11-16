import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, switchMap, tap } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { Match } from '../../../match/types/match.types';
import { analysisTone, AnalysisTone } from '../../domain/analysis-coverage';
import { buildAdminBoard } from '../../domain/admin-board';
import { rosterWindowMatches } from '../../domain/club-agenda';
import { FormEntry, formRecord } from '../../domain/form-record';
import { divisionMatchState } from '../../domain/division-match-state';
import { greetingFor, hudDateLabel } from '../../domain/greeting';
import { dayLabel, formatLocalClock, parseWallClock } from '../../domain/match-time';
import { LINEUP_WINDOW_MS, adminRules, resolvePrimaryAction } from '../../domain/primary-action';
import { BoardModel, PrimaryAction, WidgetState, dataOf } from '../../types/home.types';
import { AdminHomeDataService, DivisionStat, RosterCounts } from './admin-home-data.service';

const CLOCK_TICK_MS = 1000;

export interface InboxItem {
  divisionId: string;
  divisionName: string;
  route: string;
}

export interface DivisionCard {
  id: string;
  name: string;
  noCoach: boolean;
  /** "2 en staff". */
  staffLabel: string;
  players: number | null;
  /** "Sáb 7 nov · 14:30"; `null` si no hay partido programado. */
  nextLabel: string | null;
  /** "En curso" o "Entretiempo" si la división tiene un partido jugándose, sea cual sea su fecha; si no, `null`. */
  liveLabel: string | null;
  last: FormEntry[];
  analysisPercent: number | null;
  tone: AnalysisTone;
}

export type AdminWidget = 'matches' | 'divisions';

/** Estado del Inicio del administrador del club. Se provee en la vista, así se destruye al salir. */
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
    now: this.now(), divisions: this.divisionsForRules(), matches: this.matches(), rosters: this.rosters()
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

  /** Divisiones sin entrenador; vacío = "todo en orden". */
  readonly inboxState = computed<WidgetState<InboxItem[]>>(() => {
    const state = this.statsState();
    if (state.status !== 'ready') return state.status === 'empty' ? { status: 'empty' } : state as WidgetState<InboxItem[]>;
    const items = this.divisions()
      .filter(division => state.data.find(stat => stat.divisionId === division.id)?.staff === 0)
      .map((division): InboxItem => ({ divisionId: division.id, divisionName: division.name, route: `/divisions/${division.id}/coaches` }));
    return items.length === 0
      ? { status: 'empty' }
      : { status: 'ready', data: items, fetchedAt: state.fetchedAt, stale: state.stale };
  });

  readonly cards = computed<DivisionCard[]>(() => this.divisions().map(division => {
    const stat = this.stats().find(candidate => candidate.divisionId === division.id);
    const ofDivision = this.matches().filter(match => match.divisionId === division.id);
    const { live, next } = divisionMatchState(ofDivision, null, this.now());
    const start = next && parseWallClock(next.date);
    const analysis = stat?.analysisPercent ?? null;
    return {
      id: division.id,
      name: division.name,
      noCoach: stat?.staff === 0,
      staffLabel: stat?.staff == null ? '' : `${stat.staff} en staff`,
      players: stat?.players ?? null,
      liveLabel: live ? (live.status === 'halftime' ? 'Entretiempo' : 'En curso') : null,
      nextLabel: start ? `${dayLabel(start)} · ${formatLocalClock(start.getTime())}` : null,
      last: formRecord(ofDivision, this.now())?.last ?? [],
      analysisPercent: analysis,
      tone: analysisTone(analysis ?? 100)
    };
  }));

  readonly divisionsState = computed<WidgetState<DivisionCard[]>>(() => {
    const state = this.statsState();
    if (state.status === 'ready') return { status: 'ready', data: this.cards(), fetchedAt: state.fetchedAt, stale: state.stale };
    return state as WidgetState<DivisionCard[]>;
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
    this.bind(() => this.data.divisionStats(this.divisions(), this.matches()), this.statsState,
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
