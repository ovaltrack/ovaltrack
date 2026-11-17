import '@angular/compiler';
import '../../testing/node-globals';
import { Injector, signal } from '@angular/core';
import { Observable, defer, of, throwError } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { PlayerStatColumn, PlayerStatistic } from '../../../match/statistics/types/statistic.types';
import { PlayerStatsApiService } from '../../../player-statistics/services/player-stats-api.service';
import { PlayerStatisticsService } from '../../../player-statistics/services/player-statistics.service';
import { PlayerMatchDTO, PlayerMatchSource, PlayerMatchStatistic } from '../../../player-statistics/types/player-statistics.types';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { PlayerSummary } from '../../domain/player-summary';
import { WidgetState } from '../../types/home.types';
import { PlayerHomeDataService } from './player-home-data.service';

describe('PlayerHomeDataService · resumen del último partido', () => {
  const match = (matchId: string, date: string): PlayerMatchDTO => ({
    matchId, date, opponentName: 'Draig Goch', divisionName: 'M18', homeScore: 22, awayScore: 14, role: 'TITULAR', slotNumber: 14, finishedAt: `${date}Z`
  });
  const columns: PlayerStatColumn[] = [];
  const stat = { values: {} } as unknown as PlayerStatistic;
  // Dos jugadas propias del tipo activo: una sin jugador asignado, o sea 50 % de análisis.
  const source: PlayerMatchSource = {
    events: [
      { eventTypeId: 't', playerId: null, teamPossession: 'OWN' },
      { eventTypeId: 't', playerId: 'p', teamPossession: 'OWN' }
    ] as unknown as PlayerMatchSource['events'],
    eventTypes: [{ id: 't', isActive: true }] as unknown as PlayerMatchSource['eventTypes']
  };

  let loadedSources: string[];
  let computedFrom: Array<[string, PlayerMatchSource]>;
  let myMatches: Observable<PlayerMatchDTO[]>;
  let sourceResult: Observable<PlayerMatchSource>;
  let statisticResult: (match: PlayerMatchDTO) => PlayerMatchStatistic | null;
  let injector: Injector & { destroy(): void };
  let service: PlayerHomeDataService;

  const lastState = (): WidgetState<PlayerSummary> => {
    let state!: WidgetState<PlayerSummary>;
    service.summary().subscribe(emitted => (state = emitted));
    return state;
  };

  beforeEach(() => {
    loadedSources = [];
    computedFrom = [];
    sourceResult = of(source);
    statisticResult = entry => ({ match: entry, columns, stat });
    const statistics = {
      getMyMatches: () => myMatches,
      loadMatchSource: (matchId: string) => defer(() => { loadedSources.push(matchId); return sourceResult; }),
      computeMatchStatistic: (entry: PlayerMatchDTO, from: PlayerMatchSource) => { computedFrom.push([entry.matchId, from]); return statisticResult(entry); }
    };
    injector = Injector.create({
      providers: [
        { provide: PlayerStatisticsService, useValue: statistics },
        { provide: PlayerStatsApiService, useValue: {} },
        { provide: DashboardSnapshotCache, useValue: { read: () => null, write: () => undefined } },
        { provide: UserContextService, useValue: { userContext: signal({ userId: 'u1' }) } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
        { provide: PlayerHomeDataService, useClass: PlayerHomeDataService, deps: [] }
      ]
    }) as Injector & { destroy(): void };
    service = injector.get(PlayerHomeDataService);
  });

  afterEach(() => injector.destroy());

  it('con varios partidos pide los eventos una sola vez, los del más reciente', () => {
    myMatches = of([match('a', '2026-10-01T15:00:00'), match('c', '2026-11-01T15:00:00'), match('b', '2026-10-20T15:00:00')]);
    const state = lastState();
    expect(loadedSources).toEqual(['c']);
    expect(state.status === 'ready' && state.data.last.matchId).toBe('c');
  });

  it('la estadística y el % de análisis salen de la misma fuente', () => {
    myMatches = of([match('a', '2026-11-01T15:00:00')]);
    const state = lastState();
    expect(computedFrom).toEqual([['a', source]]);
    expect(state.status === 'ready' && state.data.last.analysisPercent).toBe(50);
  });

  it('sin partidos jugados el widget queda vacío y no pide eventos', () => {
    myMatches = of([]);
    expect(lastState().status).toBe('empty');
    expect(loadedSources).toEqual([]);
  });

  it('sin persona asociada el widget pasa a error', () => {
    myMatches = of([match('a', '2026-11-01T15:00:00')]);
    statisticResult = () => null;
    expect(lastState().status).toBe('error');
  });

  it('si la fuente falla el widget pasa a error', () => {
    myMatches = of([match('a', '2026-11-01T15:00:00')]);
    sourceResult = throwError(() => new Error('500'));
    expect(lastState().status).toBe('error');
  });
});
