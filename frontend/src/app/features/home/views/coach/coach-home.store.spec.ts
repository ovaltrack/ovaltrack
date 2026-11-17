import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LiveMatchSource } from '../../../../core/navigation/live-match.source';
import { LiveMatchSummary } from '../../../../core/navigation/navigation.types';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { Division } from '../../../division/types/division.types';
import { Match } from '../../../match/types/match.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { FocusInput } from '../../domain/focus-rows';
import { WidgetState } from '../../types/home.types';
import { BoardExtras, CoachHomeDataService, DebtData, EMPTY_BOARD_EXTRAS, FormData } from './coach-home-data.service';
import { CoachHomeStore } from './coach-home.store';

describe('CoachHomeStore', () => {
  const NOW = new Date(2026, 10, 6, 18, 0);
  const division = (id: string, name: string): Division => ({ id, name, clubId: 'c1', ageCategory: 'SENIOR', gender: 'MALE', active: true });
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-10T15:00:00', divisionId: 'd1', status: 'not_started', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });

  let matches: WidgetState<Match[]>;
  let debt: WidgetState<DebtData>;
  let jerseys: WidgetState<number>;
  let form: WidgetState<FormData>;
  let focus: WidgetState<FocusInput>;
  let extras: BoardExtras;
  const liveMatch = signal<LiveMatchSummary | null>(null);
  const online = signal(true);
  const divisions = signal<Division[]>([]);
  const remembered = new Map<string, unknown>();
  /** `Injector.create` devuelve un injector de entorno; `destroy()` corre los `onDestroy` (corta relojes y suscripciones). */
  let injector: Injector & { destroy(): void };

  let matchesLoad: () => Observable<WidgetState<Match[]>>;
  let debtLoad: () => Observable<WidgetState<DebtData>>;
  const data = {
    matches: (): Observable<WidgetState<Match[]>> => matchesLoad(),
    boardExtras: () => of(extras),
    invalidateCoverage: () => undefined,
    debt: () => debtLoad(),
    playersWithoutJersey: () => of(jerseys),
    form: () => of(form),
    focus: () => of(focus)
  };

  function createStore(): CoachHomeStore {
    injector = Injector.create({
      providers: [
        { provide: CoachHomeDataService, useValue: data },
        { provide: LiveMatchSource, useValue: { liveMatch } },
        { provide: ConnectivityService, useValue: { online } },
        {
          provide: UserContextService,
          useValue: { activeDivisions: divisions, userContext: signal({ userId: 'u1', firstName: 'Tomás' }), currentClub: signal({ name: 'PMRC' }) }
        },
        {
          provide: DashboardSnapshotCache,
          useValue: { read: (_: string, widget: string) => remembered.has(widget) ? { data: remembered.get(widget), fetchedAt: 0 } : null, write: (_: string, widget: string, value: unknown) => remembered.set(widget, value) }
        },
        { provide: CoachHomeStore, useClass: CoachHomeStore, deps: [] }
      ]
    }) as Injector & { destroy(): void };
    const store = injector.get(CoachHomeStore);
    store.now.set(NOW);
    return store;
  }

  /** Store con cargas propias de partidos y de Deuda, para contar cuántas veces se piden. */
  function createStoreWith(loadMatches: typeof matchesLoad, loadDebt: typeof debtLoad): CoachHomeStore {
    matchesLoad = loadMatches;
    debtLoad = loadDebt;
    return createStore();
  }

  beforeEach(() => {
    matchesLoad = () => of(matches);
    debtLoad = () => of(debt);
    matches = { status: 'ready', data: [], fetchedAt: 1, stale: false };
    debt = { status: 'empty' };
    jerseys = { status: 'ready', data: 0, fetchedAt: 1, stale: false };
    form = { status: 'empty' };
    focus = { status: 'empty' };
    extras = EMPTY_BOARD_EXTRAS;
    liveMatch.set(null);
    online.set(true);
    divisions.set([division('d1', 'Superior'), division('d2', 'Intermedia')]);
    remembered.clear();
  });

  afterEach(() => injector?.destroy());

  it('sin divisiones muestra el onboarding de espera y ningún primario', () => {
    divisions.set([]);
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual({ kind: 'onboarding', step: 'await-division' });
    expect(store.primary()).toBeNull();
  });

  it('un widget en error no afecta a los demás', () => {
    jerseys = { status: 'error', message: 'No pudimos cargar esto' };
    matches = { status: 'ready', data: [match({})], fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    expect(store.pendingState().status).toBe('error');
    expect(store.matchesState().status).toBe('ready');
    expect(store.board().kind).toBe('next');
  });

  it('«Qué trabajar» en error no afecta a Forma, Pendientes ni al tablero, y cada uno se reintenta por separado', () => {
    focus = { status: 'error', message: 'No pudimos cargar esto' };
    form = { status: 'ready', data: { record: { wins: 1, draws: 0, losses: 0, diff: 3, averageFor: 10, averageAgainst: 7, last: [] }, percents: {} }, fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    expect(store.focusState().status).toBe('error');
    expect(store.formState().status).toBe('ready');
    expect(store.pendingState().status).toBe('empty');
    expect(store.board().kind).toBe('onboarding');
    focus = { status: 'ready', data: { series: { lineout: [], tackle: [], penalties: [] }, lineoutLast: null }, fetchedAt: 2, stale: false };
    store.retry('focus');
    expect(store.focusState().status).toBe('ready');
  });

  it('si la respuesta trae los mismos partidos que el snapshot, lo derivado se pide una sola vez', () => {
    const cached = [match({})];
    let debtLoads = 0;
    const store = createStoreWith(
      () => of<WidgetState<Match[]>>({ status: 'ready', data: cached, fetchedAt: 1, stale: true }, { status: 'ready', data: [...cached], fetchedAt: 2, stale: false }),
      () => { debtLoads++; return of(debt); });
    store.reload();
    expect(store.matchesState()).toEqual({ status: 'ready', data: cached, fetchedAt: 2, stale: false });
    expect(debtLoads).toBe(1);
  });

  it('si la respuesta trae partidos distintos al snapshot, lo derivado se vuelve a pedir', () => {
    let debtLoads = 0;
    const store = createStoreWith(
      () => of<WidgetState<Match[]>>({ status: 'ready', data: [match({})], fetchedAt: 1, stale: true }, { status: 'ready', data: [match({ id: 'm2' })], fetchedAt: 2, stale: false }),
      () => { debtLoads++; return of(debt); });
    store.reload();
    expect(debtLoads).toBe(2);
  });

  it('sin conexión «Qué trabajar» muestra la última vista guardada con su sello', () => {
    const snapshot: FocusInput = { series: { lineout: [70, 72, 60], tackle: [], penalties: [] }, lineoutLast: { won: 6, total: 10 } };
    focus = { status: 'ready', data: snapshot, fetchedAt: 1_000, stale: true };
    online.set(false);
    const store = createStore();
    store.reload();
    expect(store.focusState()).toEqual({ status: 'ready', data: snapshot, fetchedAt: 1_000, stale: true });
  });

  it('la pestaña activa: la elegida gana, luego la del partido que captura, luego la recordada y la primera', () => {
    matches = { status: 'ready', data: [match({ id: 'm9', divisionId: 'd2', status: 'in_progress' })], fetchedAt: 1, stale: false };
    remembered.set('active-division', 'd1');
    const store = createStore();
    expect(store.activeDivisionId()).toBe('d1');

    store.reload();
    liveMatch.set({ matchId: 'm9', status: 'in_progress', divisionLabel: 'Intermedia', homeScore: 0, awayScore: 0 });
    expect(store.activeDivisionId()).toBe('d2');

    store.selectDivision('d1');
    expect(store.activeDivisionId()).toBe('d1');
    expect(remembered.get('active-division')).toBe('d1');
  });

  it('con el partido capturándose en otro dispositivo nunca se ofrece capturar', () => {
    matches = { status: 'ready', data: [match({ status: 'in_progress', date: '2026-11-06T17:00:00' })], fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    expect(store.board().kind).toBe('live-elsewhere');
    expect(store.primary()?.kind).not.toBe('capture-live');
    expect(store.primary()?.kind).not.toBe('continue-capture');
  });

  it('con el partido en curso en este dispositivo el primario es continuar captura', () => {
    matches = { status: 'ready', data: [match({ status: 'in_progress', date: '2026-11-06T17:00:00' })], fetchedAt: 1, stale: false };
    liveMatch.set({ matchId: 'm1', status: 'in_progress', divisionLabel: 'Superior', homeScore: 0, awayScore: 0 });
    const store = createStore();
    store.reload();
    expect(store.board().kind).toBe('live-here');
    expect(store.primary()?.kind).toBe('continue-capture');
  });

  it('la deuda de análisis es el primario del último partido si no hay nada más urgente', () => {
    matches = { status: 'ready', data: [match({ id: 'f1', status: 'finished', date: '2026-11-01T15:00:00' }), match({ id: 'n1', date: '2026-11-20T15:00:00' })], fetchedAt: 1, stale: false };
    debt = { status: 'ready', data: { matchId: 'f1', opponent: 'Trelew', dateLabel: '1 nov', percent: 78, withoutPlayer: 12, minutesWithoutZone: 35 }, fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    expect(store.primary()).toEqual(jasmine.objectContaining({ kind: 'complete-analysis', target: 'board' }));
  });

  it('el análisis pendiente del último partido es la variante «analysis» y el primario va al tablero', () => {
    matches = { status: 'ready', data: [match({ id: 'f1', status: 'finished', date: '2026-11-01T15:00:00', homeScore: 21, awayScore: 13 }), match({ id: 'n1', status: 'not_started', date: '2026-11-20T15:00:00' })], fetchedAt: 1, stale: false };
    debt = { status: 'ready', data: { matchId: 'f1', opponent: 'Trelew', dateLabel: '1 nov', percent: 78, withoutPlayer: 12, minutesWithoutZone: 35 }, fetchedAt: 1, stale: false };
    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 8 } };
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual(jasmine.objectContaining({ kind: 'analysis', matchId: 'f1', percent: 78, withoutPlayer: 12, minutesWithoutZone: 35 }));
    expect(store.primary()).toEqual(jasmine.objectContaining({ kind: 'complete-analysis', target: 'board', queryParams: { pendientes: 1 } }));
  });

  it('Convocar: con suplentes 6/8 a menos de 72 h el tablero y el primario piden la alineación, aunque el análisis esté pendiente', () => {
    matches = { status: 'ready', data: [match({ id: 'f1', status: 'finished', date: '2026-11-01T15:00:00' }), match({ id: 'n1', status: 'not_started', date: '2026-11-08T15:00:00' })], fetchedAt: 1, stale: false };
    debt = { status: 'ready', data: { matchId: 'f1', opponent: 'Trelew', dateLabel: '1 nov', percent: 78, withoutPlayer: 12, minutesWithoutZone: 0 }, fetchedAt: 1, stale: false };
    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 6 }, squadSize: 52 };
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual(jasmine.objectContaining({ kind: 'next', squadSize: 52, callUp: jasmine.objectContaining({ title: 'Armá la nómina del domingo' }) }));
    expect(store.primary()).toEqual(jasmine.objectContaining({ kind: 'define-lineup', target: 'board' }));
  });

  it('el primario siempre cae en el tablero, en cada variante', () => {
    const scenarios: Match[][] = [
      [match({ status: 'in_progress', date: '2026-11-07T14:30:00' })],
      [match({ status: 'not_started', date: '2026-11-06T20:00:00' })],
      [match({ status: 'empty_roster', date: '2026-11-08T15:00:00' })],
      [match({ status: 'finished', date: '2026-11-01T15:00:00' })],
      []
    ];
    for (const data of scenarios) {
      matches = { status: 'ready', data, fetchedAt: 1, stale: false };
      const store = createStore();
      store.reload();
      const primary = store.primary();
      expect(primary === null || primary.target === 'board').toBeTrue();
    }
  });

  it('pendientes: suplentes que faltan y jugadores sin dorsal', () => {
    matches = { status: 'ready', data: [match({ status: 'not_started', date: '2026-11-07T15:00:00' })], fetchedAt: 1, stale: false };
    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 6 } };
    jerseys = { status: 'ready', data: 2, fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    const state = store.pendingState();
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data.map(item => item.text)).toEqual(['Faltan 2 suplentes', '2 jugadores sin dorsal']);
      expect(state.data[1].route).toBe('/divisions/d1/players');
    }
  });

  it('pendientes: el análisis pendiente aparece cuando el tablero está en Convocar y no cuando está en Analizar', () => {
    const finishedMatch = match({ id: 'f1', status: 'finished', date: '2026-11-01T15:00:00' });
    debt = { status: 'ready', data: { matchId: 'f1', opponent: 'Trelew', dateLabel: '1 nov', percent: 78, withoutPlayer: 12, minutesWithoutZone: 0 }, fetchedAt: 1, stale: false };
    matches = { status: 'ready', data: [finishedMatch, match({ id: 'n1', status: 'not_started', date: '2026-11-08T15:00:00' })], fetchedAt: 1, stale: false };
    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 6 } };
    let store = createStore();
    store.reload();
    expect(store.board().kind).toBe('next');
    const convocar = store.pendingState();
    expect(convocar.status === 'ready' && convocar.data.map(row => row.kind)).toEqual(['analysis', 'substitutes']);
    injector.destroy();

    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 8 } };
    matches = { status: 'ready', data: [finishedMatch, match({ id: 'n1', status: 'not_started', date: '2026-11-20T15:00:00' })], fetchedAt: 1, stale: false };
    store = createStore();
    store.reload();
    expect(store.board().kind).toBe('analysis');
    expect(store.pendingState().status).toBe('empty');
  });

  it('pendientes: la nómina sin armar no se repite cuando el tablero ya pide «Armá la nómina»', () => {
    matches = { status: 'ready', data: [match({ status: 'empty_roster', date: '2026-11-08T15:00:00' })], fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual(jasmine.objectContaining({ kind: 'next', callUp: jasmine.anything() }));
    expect(store.pendingState().status).toBe('empty');
  });

  it('próximas fechas: hasta 3 de la división activa, con el chip de nómina en la primera', () => {
    matches = { status: 'ready', data: [
      match({ id: 'a', date: '2026-11-10T15:00:00' }), match({ id: 'b', date: '2026-11-17T15:00:00' }),
      match({ id: 'c', date: '2026-11-24T15:00:00' }), match({ id: 'd', date: '2026-12-01T15:00:00' }),
      match({ id: 'x', divisionId: 'd2', date: '2026-11-09T15:00:00' })
    ], fetchedAt: 1, stale: false };
    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 6 } };
    const store = createStore();
    store.reload();
    const state = store.upcomingState();
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data.map(fixture => fixture.matchId)).toEqual(['a', 'b', 'c']);
      expect(state.data[0].rosterChip).toBe('Suplentes 6/8');
      expect(state.data[1].rosterChip).toBeNull();
    }
  });

  it('próximas fechas: sin partidos por jugar está vacío, y el error de partidos se propaga sin tocar a los demás', () => {
    const store = createStore();
    store.reload();
    expect(store.upcomingState().status).toBe('empty');
    matches = { status: 'error', message: 'No pudimos cargar esto' };
    store.reload();
    expect(store.upcomingState().status).toBe('error');
    expect(store.formState().status).toBe('empty');
  });

  it('pendientes vacío cuando la nómina está completa y todos tienen dorsal', () => {
    matches = { status: 'ready', data: [match({ status: 'not_started', date: '2026-11-07T15:00:00' })], fetchedAt: 1, stale: false };
    extras = { ...EMPTY_BOARD_EXTRAS, roster: { starters: 15, substitutes: 8 } };
    const store = createStore();
    store.reload();
    expect(store.pendingState().status).toBe('empty');
  });

  it('el saludo y la fecha del HUD salen del reloj del store', () => {
    const store = createStore();
    expect(store.hudTitle()).toBe('Buenas tardes, Tomás');
    expect(store.hudLabel()).toBe('Viernes 6 nov · PMRC');
  });

  it('división con partidos jugados y ninguno programado: tablero team-idle y "Programar partido" como primario', () => {
    matches = { status: 'ready', data: [match({ status: 'finished', date: '2026-10-17T15:00:00', homeScore: 32, awayScore: 21 })], fetchedAt: 1, stale: false };
    const store = createStore();
    store.reload();
    expect(store.board().kind).toBe('team-idle');
    expect(store.primary()).toEqual(jasmine.objectContaining({ kind: 'schedule-match', route: '/match-selection', target: 'board' }));
  });
});
