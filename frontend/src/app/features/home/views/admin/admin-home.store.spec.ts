import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { Division } from '../../../division/types/division.types';
import { Match } from '../../../match/types/match.types';
import { WidgetState } from '../../types/home.types';
import { AdminHomeDataService, DivisionStat, RosterCounts } from './admin-home-data.service';
import { AdminHomeStore } from './admin-home.store';

describe('AdminHomeStore', () => {
  const NOW = new Date(2026, 10, 6, 18, 0);
  const division = (id: string, name: string): Division => ({ id, name, clubId: 'c1', ageCategory: 'SENIOR', gender: 'MALE', active: true });
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'empty_roster', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });
  const stat = (divisionId: string, staff: number | null): DivisionStat => ({ divisionId, staff, players: 20, analysisPercent: 78 });
  const ready = <T>(data: T): WidgetState<T> => ({ status: 'ready', data, fetchedAt: 1, stale: false });

  let matches: WidgetState<Match[]>;
  let stats: WidgetState<DivisionStat[]>;
  let rosters: RosterCounts;
  let requestedRosters: string[];
  const divisions = signal<Division[]>([]);
  let injector: Injector & { destroy(): void };

  const data = {
    matches: (): Observable<WidgetState<Match[]>> => of(matches),
    rosters: (requested: readonly Match[]) => {
      requestedRosters = requested.map(candidate => candidate.id);
      return of(rosters);
    },
    divisionStats: () => of(stats)
  };

  function createStore(): AdminHomeStore {
    injector = Injector.create({
      providers: [
        { provide: AdminHomeDataService, useValue: data },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
        {
          provide: UserContextService,
          useValue: { activeDivisions: divisions, userContext: signal({ userId: 'u1', firstName: 'Laura' }), currentClub: signal({ id: 'c1', name: 'Puerto Madryn RC' }) }
        },
        { provide: AdminHomeStore, useClass: AdminHomeStore, deps: [] }
      ]
    }) as Injector & { destroy(): void };
    const store = injector.get(AdminHomeStore);
    store.now.set(NOW);
    return store;
  }

  beforeEach(() => {
    matches = ready([]);
    stats = ready([stat('d1', 2), stat('d2', 1)]);
    rosters = {};
    requestedRosters = [];
    data.divisionStats = () => of(stats);
    divisions.set([division('d1', 'Superior'), division('d2', 'M15')]);
  });

  afterEach(() => injector?.destroy());

  it('sin divisiones: onboarding para crear la primera y ningún otro primario', () => {
    divisions.set([]);
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual({ kind: 'onboarding', step: 'create-division' });
    expect(store.primary()?.kind).toBe('create-division');
  });

  it('partido sin nómina a menos de 72 h: primario "Definir alineación <división>" en el tablero', () => {
    matches = ready([match({})]);
    const store = createStore();
    store.reload();
    expect(store.primary()).toEqual(jasmine.objectContaining({ kind: 'define-lineup', label: 'Definir alineación Superior', target: 'board' }));
  });

  it('una división sin entrenador va a la bandeja y es el primario si no hay nada más urgente', () => {
    matches = ready([match({ id: 'ok', status: 'not_started' })]);
    stats = ready([stat('d1', 2), stat('d2', 0)]);
    const store = createStore();
    store.reload();
    const inbox = store.inboxState();
    expect(inbox.status).toBe('ready');
    if (inbox.status === 'ready') expect(inbox.data.map(item => item.route)).toEqual(['/divisions/d2/coaches']);
    expect(store.primary()).toEqual(jasmine.objectContaining({ kind: 'assign-coach', target: 'board' }));
  });

  it('«Lo más urgente» explica la alineación pendiente y la división sin entrenador, y queda vacío sin urgencias', () => {
    matches = ready([match({ id: 'm1', status: 'empty_roster', date: '2026-11-07T14:30:00' })]);
    let store = createStore();
    store.reload();
    const lineup = store.board();
    expect(lineup.kind === 'club-agenda' && lineup.urgent).toEqual({ title: 'Falta la alineación de Superior', detail: 'vs Trelew · Sáb 7 nov · mañana · 14:30 · Sin nómina' });
    injector.destroy();

    matches = ready([match({ id: 'ok', status: 'not_started', date: '2026-11-07T14:30:00' })]);
    rosters = { ok: { starters: 15, substitutes: 8 } };
    stats = ready([stat('d1', 2), stat('d2', 0)]);
    store = createStore();
    store.reload();
    const coach = store.board();
    expect(coach.kind === 'club-agenda' && coach.urgent).toEqual({ title: 'M15 no tiene entrenador', detail: 'Nadie puede capturar sus partidos.' });
    injector.destroy();

    stats = ready([stat('d1', 2), stat('d2', 1)]);
    store = createStore();
    store.reload();
    const calm = store.board();
    expect(calm.kind === 'club-agenda' && calm.urgent).toBeNull();
    expect(store.primary()).toBeNull();
  });

  it('mientras no se conocen los entrenadores no se acusa a nadie', () => {
    matches = ready([match({ status: 'not_started' })]);
    stats = { status: 'loading' };
    const store = createStore();
    store.reload();
    expect(store.primary()).toBeNull();
  });

  it('la bandeja queda vacía cuando todas las divisiones tienen entrenador', () => {
    const store = createStore();
    store.reload();
    expect(store.inboxState().status).toBe('empty');
  });

  it('un widget en error no afecta a los demás', () => {
    stats = { status: 'error', message: 'No pudimos cargar esto' };
    matches = ready([match({ date: '2026-11-07T10:00:00' })]);
    const store = createStore();
    store.reload();
    expect(store.divisionsState().status).toBe('error');
    expect(store.board().kind).toBe('club-agenda');
  });

  it('las tarjetas traen staff, jugadores, próximo partido y análisis', () => {
    matches = ready([match({ id: 'n', divisionId: 'd1', status: 'not_started', date: '2026-11-14T14:30:00' })]);
    const store = createStore();
    store.reload();
    const first = store.cards()[0];
    expect(first).toEqual(jasmine.objectContaining({ name: 'Superior', staffLabel: '2 en staff', players: 20, nextLabel: 'Sáb 14 nov · 14:30', analysisPercent: 78, tone: 'warn' }));
  });

  it('pide la nómina de todos los pendientes de la ventana de la agenda o de las 72 h, no solo de hoy y mañana', () => {
    matches = ready([
      match({ id: 'hoy', status: 'not_started', date: '2026-11-06T20:00:00' }),
      match({ id: 'a60h', status: 'not_started', date: '2026-11-09T06:00:00' }),
      match({ id: 'a80h', status: 'not_started', date: '2026-11-09T22:00:00' }),
      match({ id: 'jugado', status: 'finished', date: '2026-11-07T10:00:00' })
    ]);
    createStore().reload();
    expect(requestedRosters).toEqual(['hoy', 'a60h']);
  });

  it('un partido en curso con fecha de mañana: tablero de hoy y tarjeta de la división en curso, no "sin partido"', () => {
    matches = ready([match({ id: 'vivo', status: 'in_progress', date: '2026-11-07T14:30:00' })]);
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual(jasmine.objectContaining({ kind: 'club-agenda', title: 'Hoy en el club' }));
    expect(store.cards()[0]).toEqual(jasmine.objectContaining({ name: 'Superior', liveLabel: 'En curso', nextLabel: null }));
    expect(store.cards()[1].liveLabel).toBeNull();
  });

  it('un refresco de las estadísticas no vuelve a "loading" lo que ya tiene datos', () => {
    const emissions: WidgetState<DivisionStat[]>[] = [{ status: 'loading' }, stats];
    data.divisionStats = () => of(...emissions);
    const store = createStore();
    store.reload();
    expect(store.statsState().status).toBe('ready');
    store.retry('divisions');
    expect(store.statsState().status).toBe('ready');
  });

  it('un error posterior sí reemplaza los datos, y reintentar muestra la carga', () => {
    const store = createStore();
    store.reload();
    const failing: WidgetState<DivisionStat[]>[] = [{ status: 'loading' }, { status: 'error', message: 'No pudimos cargar esto' }];
    data.divisionStats = () => of(...failing);
    store.retry('divisions');
    expect(store.statsState().status).toBe('error');
    const loadingOnly: WidgetState<DivisionStat[]>[] = [{ status: 'loading' }];
    data.divisionStats = () => of(...loadingOnly);
    store.retry('divisions');
    expect(store.statsState().status).toBe('loading');
  });

  it('el encabezado resume el club y las divisiones', () => {
    const store = createStore();
    expect(store.hudSubtitle()).toBe('Puerto Madryn RC · 2 divisiones');
    expect(store.hudTitle()).toBe('Buenas tardes, Laura');
  });
});
