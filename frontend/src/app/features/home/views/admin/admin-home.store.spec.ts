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

  it('una división sin entrenador se marca en la tabla y es el primario si no hay nada más urgente', () => {
    matches = ready([match({ id: 'ok', status: 'not_started' })]);
    stats = ready([stat('d1', 2), stat('d2', 0)]);
    const store = createStore();
    store.reload();
    const table = store.statusState();
    expect(table.status).toBe('ready');
    if (table.status === 'ready') expect(table.data.filter(row => row.action?.label === 'Asignar entrenador').map(row => row.action?.route)).toEqual(['/divisions/d2/coaches']);
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

  it('la tabla no marca nada cuando todas las divisiones tienen entrenador y plantel suficiente', () => {
    const store = createStore();
    store.reload();
    const table = store.statusState();
    expect(table.status === 'ready' && table.data.every(row => row.action === null)).toBeTrue();
  });

  it('un widget en error no afecta a los demás', () => {
    stats = { status: 'error', message: 'No pudimos cargar esto' };
    matches = ready([match({ date: '2026-11-07T10:00:00' })]);
    const store = createStore();
    store.reload();
    expect(store.statusState().status).toBe('error');
    expect(store.board().kind).toBe('club-agenda');
  });

  it('la tabla trae staff, plantel, próximo partido y análisis de cada división, en el orden del club', () => {
    matches = ready([match({ id: 'n', divisionId: 'd1', status: 'not_started', date: '2026-11-14T14:30:00' })]);
    const store = createStore();
    store.reload();
    const table = store.statusState();
    if (table.status !== 'ready') throw new Error('tabla no lista');
    expect(table.data.map(row => row.name)).toEqual(['Superior', 'M15']);
    expect(table.data[0]).toEqual(jasmine.objectContaining({ staff: { text: '2 en staff', issue: null }, next: jasmine.objectContaining({ text: 'Sáb 14 nov' }), analysis: { percent: 78, tone: 'warn' } }));
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

  it('un partido en curso con fecha de mañana: agenda de hoy y fila de la división «En curso», no «Sin partido»', () => {
    matches = ready([match({ id: 'vivo', status: 'in_progress', date: '2026-11-07T14:30:00' })]);
    const store = createStore();
    store.reload();
    expect(store.board()).toEqual(jasmine.objectContaining({ kind: 'club-agenda', title: 'Hoy en el club' }));
    const table = store.statusState();
    if (table.status !== 'ready') throw new Error('tabla no lista');
    expect(table.data[0].next).toEqual(jasmine.objectContaining({ text: 'En curso', live: true }));
    expect(table.data[1].next.text).toBe('Sin partido');
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

  it('KPIs del club: salen de las estadísticas y de los partidos del año; en error o cargando no hay números', () => {
    matches = ready([match({ id: 'f', status: 'finished', date: '2026-10-01T15:00:00', homeScore: 10, awayScore: 3 })]);
    const store = createStore();
    store.reload();
    const kpis = store.kpisState();
    expect(kpis.status).toBe('ready');
    if (kpis.status === 'ready') expect(kpis.data.map(kpi => [kpi.key, kpi.value])).toEqual([['players', '40'], ['matches', '1'], ['analysis', '78 %'], ['pending', '2']]);
    injector.destroy();

    stats = { status: 'loading' };
    const loading = createStore();
    loading.reload();
    expect(loading.kpisState().status).toBe('loading');
    injector.destroy();

    stats = { status: 'error', message: 'No pudimos cargar esto' };
    const failing = createStore();
    failing.reload();
    expect(failing.kpisState().status).toBe('error');
    expect(failing.board().kind).toBe('club-idle');
  });

  it('el encabezado resume el club y las divisiones', () => {
    const store = createStore();
    expect(store.hudSubtitle()).toBe('Puerto Madryn RC · 2 divisiones');
    expect(store.hudTitle()).toBe('Buenas tardes, Laura');
  });

  describe('refreshing', () => {
    it('es falso cuando todo está al día', () => {
      const store = createStore();
      store.reload();
      expect(store.refreshing()).toBeFalse();
    });

    it('es verdadero mientras los partidos cargan sin snapshot', () => {
      matches = { status: 'loading' };
      const store = createStore();
      store.reload();
      expect(store.refreshing()).toBeTrue();
    });

    it('es verdadero si un widget muestra un dato viejo mientras llega el real', () => {
      stats = { status: 'ready', data: [stat('d1', 2)], fetchedAt: 1, stale: true, refreshing: true };
      const store = createStore();
      store.reload();
      expect(store.refreshing()).toBeTrue();
    });
  });
});
