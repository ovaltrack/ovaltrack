import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { RosterService } from './roster.service';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { AvailablePlayer } from '../types/roster.types';
import { buildBackendMatch, buildMatch, clearLocalDatabases, nextRequest } from '../../../testing/offline-test-helpers';

const players: AvailablePlayer[] = [
  { id: 'p-1', fullName: 'Uno', jerseyNumber: 1, position: null },
  { id: 'p-2', fullName: 'Dos', jerseyNumber: 2, position: null },
];

describe('RosterService', () => {
  let service: RosterService;
  let cache: LocalDatabaseService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RosterService);
    cache = TestBed.inject(LocalDatabaseService);
    httpMock = TestBed.inject(HttpTestingController);
    await clearLocalDatabases();
  });

  afterEach(() => httpMock.verify());

  describe('getAvailablePlayers', () => {
    it('busca la división del partido, trae sus jugadores y los deja en Dexie', async () => {
      const loading = firstValueFrom(service.getAvailablePlayers('match-1'));
      (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1')))
        .flush(buildBackendMatch({ divisionId: 'division-1' }));
      (await nextRequest(httpMock, req => req.url.endsWith('/division/division-1/players')))
        .flush(players);

      expect(await loading).toEqual(players);
      expect((await cache.getPersonsByDivisionId('division-1')).map(player => player.id))
        .toEqual(['p-1', 'p-2']);
    });

    it('sin red devuelve los jugadores de la división guardados en Dexie', async () => {
      await cache.saveMatches([buildMatch({ divisionId: 'division-1' })]);
      await cache.savePersonsByDivisionId(players.map(player => ({ ...player, divisionId: 'division-1' })));

      const loading = firstValueFrom(service.getAvailablePlayers('match-1'));
      (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1')))
        .error(new ProgressEvent('error'), { status: 0 });

      expect((await loading).map(player => player.id)).toEqual(['p-1', 'p-2']);
    });
  });

  describe('getRosterBootstrap', () => {
    const rosterPlayers = [
      { id: 'p-1', fullName: 'Uno', position: null, number: 1, role: 'TITULAR', fieldStatus: 'EN_CANCHA', fieldSlot: 1, slotOrder: 0 },
      { id: 'p-2', fullName: 'Dos', position: null, number: 2, role: 'SUPLENTE', fieldStatus: 'EN_BANCO', fieldSlot: null, slotOrder: 0 },
    ];

    it('trae partido, jugadores y plantel en una petición y los deja en Dexie', async () => {
      const loading = firstValueFrom(service.getRosterBootstrap('match-1'));
      (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/roster-bootstrap')))
        .flush({ match: buildBackendMatch({ divisionId: 'division-1' }), players, roster: rosterPlayers });

      const bootstrap = await loading;
      expect(bootstrap.match.divisionId).toBe('division-1');
      expect(bootstrap.players).toEqual(players);
      expect(bootstrap.roster.startingPlayers.map(entry => entry.playerId)).toEqual(['p-1']);
      expect(bootstrap.roster.substitutePlayers.map(entry => entry.playerId)).toEqual(['p-2']);
      expect((await cache.getPersonsByDivisionId('division-1')).map(player => player.id)).toEqual(['p-1', 'p-2']);
      expect((await cache.getRoster('match-1'))?.startingPlayers.length).toBe(1);
    });

    it('sin red devuelve partido, jugadores y plantel guardados en Dexie', async () => {
      await cache.saveMatches([buildMatch({ divisionId: 'division-1' })]);
      await cache.savePersonsByDivisionId(players.map(player => ({ ...player, divisionId: 'division-1' })));

      const loading = firstValueFrom(service.getRosterBootstrap('match-1'));
      (await nextRequest(httpMock, req => req.url.endsWith('/matches/match-1/roster-bootstrap')))
        .error(new ProgressEvent('error'), { status: 0 });

      const bootstrap = await loading;
      expect(bootstrap.match.id).toBe('match-1');
      expect(bootstrap.players.map(player => player.id)).toEqual(['p-1', 'p-2']);
      expect(bootstrap.roster).toEqual({ startingPlayers: [], substitutePlayers: [] });
    });
  });
});
