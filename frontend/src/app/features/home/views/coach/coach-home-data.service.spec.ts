import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { DivisionStatisticsService } from '../../../division-statistics/services/division-statistics.service';
import { EventService } from '../../../match/services/event.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { ZoneService } from '../../../match/services/zone.service';
import { MatchCoverageResponse } from '../../../match/types/event.types';
import { Match } from '../../../match/types/match.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { WidgetState } from '../../types/home.types';
import { CoachHomeDataService, DebtData, FormData } from './coach-home-data.service';

describe('CoachHomeDataService · cobertura del último partido', () => {
  const finished = (id: string, date: string): Match => ({
    id, date, divisionId: 'd1', status: 'finished', currentPeriod: 2, clockElapsedSeconds: 0, clockPaused: true,
    currentPossession: 'NEUTRAL', homeScore: 10, awayScore: 5, finishedAt: `${date}Z`,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }
  });
  const now = new Date(2026, 10, 6, 18, 0);

  let coverageCalls: string[][];
  let coverageResult: (ids: readonly string[]) => Observable<MatchCoverageResponse[]>;
  let injector: Injector & { destroy(): void };
  let service: CoachHomeDataService;
  let statisticsCalls: string[];
  let statisticsResult: Observable<unknown>;
  const cacheWrites: Array<[string, unknown]> = [];

  beforeEach(() => {
    coverageCalls = [];
    coverageResult = ids => of(ids.map(matchId => ({ matchId, totalEvents: 10, withoutPlayer: 2, percent: 80 })));
    statisticsCalls = [];
    cacheWrites.length = 0;
    statisticsResult = of({ matches: [] });
    const eventService = {
      getCoverage: (ids: readonly string[]): Observable<MatchCoverageResponse[]> => defer(() => { coverageCalls.push([...ids]); return coverageResult(ids); })
    };
    injector = Injector.create({
      providers: [
        { provide: MatchService, useValue: {} },
        { provide: RosterService, useValue: {} },
        { provide: EventService, useValue: eventService },
        { provide: ZoneService, useValue: { list: () => of({ assignments: [] }) } },
        { provide: DivisionPlayerService, useValue: {} },
        { provide: DivisionStatisticsService, useValue: { getDivisionStatistics: (id: string, from: string, to: string) => { statisticsCalls.push(`${id} ${from} ${to}`); return statisticsResult; } } },
        { provide: OfflineMatchReader, useValue: {} },
        { provide: DashboardSnapshotCache, useValue: { read: () => null, write: (_: string, widget: string, data: unknown) => { cacheWrites.push([widget, data]); } } },
        { provide: UserContextService, useValue: { userContext: signal({ userId: 'u1' }) } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
        { provide: CoachHomeDataService, useClass: CoachHomeDataService, deps: [] }
      ]
    }) as Injector & { destroy(): void };
    service = injector.get(CoachHomeDataService);
  });

  afterEach(() => injector.destroy());

  const matches = [finished('a', '2026-10-30T15:00:00'), finished('b', '2026-11-01T15:00:00')];

  it('Deuda y Forma comparten una sola petición de cobertura con la unión de sus partidos', () => {
    service.debt(matches, now).subscribe();
    service.form(matches, now).subscribe();
    expect(coverageCalls).toEqual([['a', 'b']]);
  });

  it('después de invalidar vuelve a pedir la cobertura', () => {
    service.debt(matches, now).subscribe();
    service.invalidateCoverage();
    service.debt(matches, now).subscribe();
    expect(coverageCalls.length).toBe(2);
  });

  it('el % y las jugadas sin jugador de Deuda salen de la cobertura del último partido', () => {
    coverageResult = ids => of(ids.map(matchId => ({ matchId, totalEvents: 20, withoutPlayer: matchId === 'b' ? 5 : 1, percent: matchId === 'b' ? 75 : 95 })));
    const states: WidgetState<DebtData>[] = [];
    service.debt(matches, now).subscribe(state => states.push(state));
    const last = states.at(-1);
    expect(last?.status === 'ready' && last.data).toEqual(jasmine.objectContaining({ matchId: 'b', percent: 75, withoutPlayer: 5, minutesWithoutZone: 80 }));
  });

  it('el % de cada partido de Forma sale de la cobertura', () => {
    coverageResult = ids => of(ids.map(matchId => ({ matchId, totalEvents: 20, withoutPlayer: 1, percent: matchId === 'b' ? 75 : 95 })));
    const states: WidgetState<FormData>[] = [];
    service.form(matches, now).subscribe(state => states.push(state));
    const last = states.at(-1);
    expect(last?.status === 'ready' && last.data.percents).toEqual({ a: 95, b: 75 });
  });

  it('si la cobertura falla, Forma deja null por partido y Deuda pasa a error', () => {
    coverageResult = () => defer(() => { throw new Error('boom'); });
    const forms: WidgetState<FormData>[] = [];
    const debts: WidgetState<DebtData>[] = [];
    service.form(matches, now).subscribe(state => forms.push(state));
    service.invalidateCoverage();
    service.debt(matches, now).subscribe(state => debts.push(state));
    const form = forms.at(-1);
    expect(form?.status === 'ready' && form.data.percents).toEqual({ a: null, b: null });
    expect(debts.at(-1)?.status).toBe('error');
  });

  it('«Qué trabajar» hace una sola llamada de la temporada y guarda su snapshot por división', () => {
    statisticsResult = of({
      matches: [{ matchId: 'x', date: '2026-02-01T15:00:00', opponentName: 'R', statistics: { ownLineoutsWon: 3, ownLineoutsLost: 1, ownTacklesCompleted: 0, ownTacklesMissed: 0, ownTackleEffectiveness: 0, ownPenaltiesConceded: 4 } }]
    });
    const states: string[] = [];
    service.focus('d1', now).subscribe(state => states.push(state.status));
    expect(statisticsCalls).toEqual(['d1 2026-01-01 2026-11-06']);
    expect(states).toEqual(['loading', 'ready']);
    expect(cacheWrites[0][0]).toBe('coach.focus.d1');
    expect(cacheWrites[0][1]).toEqual({ series: { lineout: [75], tackle: [], penalties: [4] }, lineoutLast: { won: 3, total: 4 } });
  });

  it('«Qué trabajar» devuelve error (sin propagarlo) si la llamada falla y no hay snapshot', () => {
    statisticsResult = defer(() => { throw new Error('boom'); });
    const states: string[] = [];
    service.focus('d1', now).subscribe(state => states.push(state.status));
    expect(states).toEqual(['loading', 'error']);
  });

  it('los snapshots de Forma y Deuda son por división, para no mostrar sin red el dato de otra pestaña', () => {
    service.form(matches, now).subscribe();
    service.debt(matches, now).subscribe();
    const keys = cacheWrites.map(([widget]) => widget);
    expect(keys).toContain('coach.form.d1');
    expect(keys).toContain('coach.debt.d1');
  });
});
