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
  let extras: BoardExtras;
  const liveMatch = signal<LiveMatchSummary | null>(null);
  const online = signal(true);
  const divisions = signal<Division[]>([]);
  const remembered = new Map<string, unknown>();
  /** `Injector.create` devuelve un injector de entorno; `destroy()` corre los `onDestroy` (corta relojes y suscripciones). */
  let injector: Injector & { destroy(): void };

  const data = {
    matches: (): Observable<WidgetState<Match[]>> => of(matches),
    boardExtras: () => of(extras),
    invalidateEvents: () => undefined,
    debt: () => of(debt),
    playersWithoutJersey: () => of(jerseys),
    form: () => of(form)
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

  beforeEach(() => {
    matches = { status: 'ready', data: [], fetchedAt: 1, stale: false };
    debt = { status: 'empty' };
    jerseys = { status: 'ready', data: 0, fetchedAt: 1, stale: false };
    form = { status: 'empty' };
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
