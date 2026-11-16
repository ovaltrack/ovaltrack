import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
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

  beforeEach(() => {
    calls = [];
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
        { provide: OfflineMatchReader, useValue: {} },
        { provide: DashboardSnapshotCache, useValue: { read: () => null, write: () => undefined } },
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
});
