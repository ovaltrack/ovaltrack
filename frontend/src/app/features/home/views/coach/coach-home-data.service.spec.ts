import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { DivisionStatisticsService } from '../../../division-statistics/services/division-statistics.service';
import { EventService } from '../../../match/services/event.service';
import { EventTypeService } from '../../../match/services/event-type.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { ZoneService } from '../../../match/services/zone.service';
import { Match } from '../../../match/types/match.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { CoachHomeDataService } from './coach-home-data.service';

describe('CoachHomeDataService · eventos del último partido', () => {
  const finished = (id: string, date: string): Match => ({
    id, date, divisionId: 'd1', status: 'finished', currentPeriod: 2, clockElapsedSeconds: 0, clockPaused: true,
    currentPossession: 'NEUTRAL', homeScore: 10, awayScore: 5, finishedAt: `${date}Z`,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }
  });
  const now = new Date(2026, 10, 6, 18, 0);

  let calls: string[];
  let injector: Injector & { destroy(): void };
  let service: CoachHomeDataService;
  let statisticsCalls: string[];
  let statisticsResult: Observable<unknown>;
  const cacheWrites: Array<[string, unknown]> = [];

  beforeEach(() => {
    calls = [];
    statisticsCalls = [];
    cacheWrites.length = 0;
    statisticsResult = of({ matches: [] });
    const eventService = {
      getByMatchPostMatch: (matchId: string): Observable<unknown[]> => defer(() => { calls.push(matchId); return of([]); })
    };
    injector = Injector.create({
      providers: [
        { provide: MatchService, useValue: {} },
        { provide: RosterService, useValue: {} },
        { provide: EventService, useValue: eventService },
        { provide: EventTypeService, useValue: { getAll: () => of([]) } },
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

  it('Deuda y Forma comparten una sola petición de eventos por partido', () => {
    service.debt(matches).subscribe();
    service.form(matches, now).subscribe();
    expect(calls.filter(id => id === 'b').length).toBe(1);
    expect(calls.filter(id => id === 'a').length).toBe(1);
  });

  it('después de invalidar vuelve a pedir', () => {
    service.debt(matches).subscribe();
    service.invalidateEvents();
    service.debt(matches).subscribe();
    expect(calls.filter(id => id === 'b').length).toBe(2);
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
});
