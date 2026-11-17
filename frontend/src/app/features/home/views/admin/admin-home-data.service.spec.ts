import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DivisionCoachService } from '../../../../services/division-coach.service';
import { DivisionPlayerService } from '../../../../services/division-player.service';
import { Division } from '../../../division/types/division.types';
import { EventService } from '../../../match/services/event.service';
import { MatchService } from '../../../match/services/match.service';
import { RosterService } from '../../../match/services/roster.service';
import { MatchCoverageResponse } from '../../../match/types/event.types';
import { Match } from '../../../match/types/match.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { WidgetState } from '../../types/home.types';
import { AdminHomeDataService, DivisionStat } from './admin-home-data.service';

describe('AdminHomeDataService · análisis por división', () => {
  const finished = (id: string, divisionId: string, date: string): Match => ({
    id, date, divisionId, status: 'finished', currentPeriod: 2, clockElapsedSeconds: 0, clockPaused: true,
    currentPossession: 'NEUTRAL', homeScore: 10, awayScore: 5, finishedAt: `${date}Z`,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }
  });
  const division = (id: string): Division => ({ id, name: id } as Division);
  const now = new Date(2026, 10, 6, 18, 0);
  const matches = [
    finished('a1', 'd1', '2026-10-20T15:00:00'), finished('a2', 'd1', '2026-11-01T15:00:00'),
    finished('b1', 'd2', '2026-10-25T15:00:00')
  ];

  let coverageCalls: string[][];
  let coverageResult: (ids: readonly string[]) => Observable<MatchCoverageResponse[]>;
  let injector: Injector & { destroy(): void };
  let service: AdminHomeDataService;

  beforeEach(() => {
    coverageCalls = [];
    coverageResult = ids => of(ids.map(matchId => ({ matchId, totalEvents: 10, withoutPlayer: 1, percent: matchId === 'a2' ? 90 : 60 })));
    injector = Injector.create({
      providers: [
        { provide: MatchService, useValue: {} },
        { provide: RosterService, useValue: { getSavedRoster: () => of(null) } },
        { provide: EventService, useValue: { getCoverage: (ids: readonly string[]) => defer(() => { coverageCalls.push([...ids]); return coverageResult(ids); }) } },
        { provide: DivisionCoachService, useValue: { getByDivisionId: () => of([]) } },
        { provide: DivisionPlayerService, useValue: { getActiveByDivisionId: () => of({ totalElements: 20, content: [] }) } },
        { provide: DashboardSnapshotCache, useValue: { read: () => null, write: () => undefined } },
        { provide: UserContextService, useValue: { userContext: signal({ userId: 'u1' }) } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
        { provide: AdminHomeDataService, useClass: AdminHomeDataService, deps: [] }
      ]
    }) as Injector & { destroy(): void };
    service = injector.get(AdminHomeDataService);
  });

  afterEach(() => injector.destroy());

  const lastStats = (): DivisionStat[] | null => {
    let result: WidgetState<DivisionStat[]> | null = null;
    service.divisionStats([division('d1'), division('d2')], matches, now).subscribe(state => (result = state));
    const state = result as WidgetState<DivisionStat[]> | null;
    return state?.status === 'ready' ? state.data : null;
  };

  it('pide una sola cobertura con el último partido finalizado de cada división', () => {
    const stats = lastStats();
    expect(coverageCalls).toEqual([['a2', 'b1']]);
    expect(stats?.map(stat => [stat.divisionId, stat.analysisPercent])).toEqual([['d1', 90], ['d2', 60]]);
  });

  it('si la cobertura falla, el análisis de las divisiones queda en null', () => {
    coverageResult = () => defer(() => { throw new Error('boom'); });
    expect(lastStats()?.map(stat => stat.analysisPercent)).toEqual([null, null]);
  });

  it('sin partidos finalizados no pide cobertura', () => {
    service.divisionStats([division('d1')], [], now).subscribe();
    expect(coverageCalls).toEqual([]);
  });
});
